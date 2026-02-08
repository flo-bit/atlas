<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getAllImages,
		getImage,
		updateImage,
		deleteImage,
		storedImageToBlob,
		type StoredImage
	} from '$lib/state/image-store.svelte';
	import { nearbyPOIs, searchPOIs, type POI } from '$lib/poi';
	import { uploadBlob, putRecord, createTID, user } from '$lib/atproto';
	import { compressImage } from '$lib/atproto/image-helper';
	import { Command } from 'bits-ui';
	import MapPicker from '$lib/components/MapPicker.svelte';
	import UploadMap from '$lib/components/UploadMap.svelte';
	import ImageOverlay from '$lib/components/ImageOverlay.svelte';
	import AddImagesButton from '$lib/components/AddImagesButton.svelte';
	import { MAIN_COLLECTION } from '$lib/atproto/settings';
	import { launchConfetti } from '@foxui/visual';

	let images = $state<StoredImage[]>([]);
	let currentIndex = $state(0);
	let previewUrls = $state<Map<string, string>>(new Map());
	let done = $state(false);
	let uploadsDone = $state(0);
	let uploadsTotal = $state(0);
	let uploading = $derived(uploadsTotal > 0 && uploadsDone < uploadsTotal);

	$effect(() => {
		if (done && uploadsTotal > 0 && uploadsDone === uploadsTotal) {
			launchConfetti();
		}
	});

	let current = $derived(images[currentIndex]);
	let total = $derived(images.length);

	onMount(async () => {
		const all = await getAllImages();
		images = all
			.filter((img) => img.status === 'pending')
			.sort((a, b) => a.createdAt - b.createdAt);
		if (images.length === 0) {
			done = true;
			return;
		}
		for (const img of images) {
			previewUrls.set(img.id, URL.createObjectURL(storedImageToBlob(img)));
		}
		previewUrls = previewUrls;

		const first = images[0];
		if (first.exifGps) {
			loadNearby(first.exifGps.latitude, first.exifGps.longitude, first.id);
		}
	});

	let query = $state('');
	let showMapPicker = $state(false);
	let showImageOverlay = $state(false);
	let hoveredPoi = $state<POI | null>(null);
	let nearbyPois = $state<POI[]>([]);
	let nearbyLoading = $state(false);
	let nearbyError = $state(false);
	let textSearchResults = $state<POI[] | null>(null);
	let textSearchLoading = $state(false);
	let pois = $derived(textSearchResults ?? nearbyPois);
	let loading = $derived(nearbyLoading || textSearchLoading);
	let searchCenter = $state<{ lat: number; lng: number } | null>(null);
	let mapCenter = $derived(
		current?.exifGps
			? { lat: current.exifGps.latitude, lng: current.exifGps.longitude }
			: searchCenter
	);
	let progress = $state(0);
	let progressDuration = $state('0s');
	let showProgress = $state(false);

	let currentAbort: AbortController | null = null;
	let prefetchEntry: { imageId: string; promise: Promise<POI[]>; abort: AbortController } | null =
		null;

	function prefetchNext() {
		for (let i = currentIndex + 1; i < images.length; i++) {
			const img = images[i];
			if (img.exifGps) {
				const abort = new AbortController();
				prefetchEntry = {
					imageId: img.id,
					promise: nearbyPOIs(img.exifGps.latitude, img.exifGps.longitude, {
						signal: abort.signal
					}),
					abort
				};
				return;
			}
		}
	}

	function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
		const R = 6371;
		const dLat = ((lat2 - lat1) * Math.PI) / 180;
		const dLng = ((lng2 - lng1) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) ** 2 +
			Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
		return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}

	function formatDist(km: number): string {
		return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
	}

	let sortedPois = $derived.by(() => {
		const center = searchCenter;
		if (!center) return pois.slice(0, 50);
		return [...pois]
			.sort((a, b) => {
				const da = distanceKm(center.lat, center.lng, Number(a.latitude), Number(a.longitude));
				const db = distanceKm(center.lat, center.lng, Number(b.latitude), Number(b.longitude));
				return da - db;
			})
			.slice(0, 50);
	});

	// Debounced text search
	$effect(() => {
		const q = query;
		if (q.length < 2) {
			textSearchResults = null;
			return;
		}
		textSearchLoading = true;

		const center = searchCenter;
		const timeout = setTimeout(async () => {
			try {
				textSearchResults = await searchPOIs(q, {
					proximity: center ? { latitude: center.lat, longitude: center.lng } : undefined
				});
			} catch (e) {
				console.error('Search failed:', e);
			} finally {
				textSearchLoading = false;
			}
		}, 300);
		return () => {
			clearTimeout(timeout);
			textSearchLoading = false;
			textSearchResults = null;
		};
	});

	async function loadNearby(lat: number, lng: number, imageId?: string) {
		// Cancel any in-flight request
		currentAbort?.abort();
		const abort = new AbortController();
		currentAbort = abort;

		// Check for a valid prefetch, cancel stale ones
		let prefetched: Promise<POI[]> | null = null;
		if (imageId && prefetchEntry?.imageId === imageId) {
			prefetched = prefetchEntry.promise;
			prefetchEntry = null;
		} else if (prefetchEntry) {
			prefetchEntry.abort.abort();
			prefetchEntry = null;
		}

		searchCenter = { lat, lng };
		nearbyLoading = true;
		nearbyError = false;

		progress = 0;
		progressDuration = '0s';
		showProgress = true;
		await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		progressDuration = '3s';
		progress = 75;

		try {
			if (prefetched) {
				try {
					nearbyPois = await prefetched;
				} catch {
					nearbyPois = await nearbyPOIs(lat, lng, { signal: abort.signal });
				}
			} else {
				nearbyPois = await nearbyPOIs(lat, lng, { signal: abort.signal });
			}
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			console.error('Failed to load nearby POIs:', e);
			nearbyError = true;
		} finally {
			if (currentAbort !== abort) return; // superseded by a newer request
			nearbyLoading = false;
			progressDuration = '300ms';
			progress = 100;
			setTimeout(() => {
				showProgress = false;
				progress = 0;
				progressDuration = '0s';
			}, 350);
			if (!abort.signal.aborted && !nearbyError) prefetchNext();
		}
	}

	function clearSearch() {
		currentAbort?.abort();
		searchCenter = null;
		nearbyPois = [];
		nearbyError = false;
	}

	let uploadQueue: Array<{ imageId: string; poi: POI }> = [];
	let uploadRunning = false;

	function selectPoi(poi: POI) {
		const snap = $state.snapshot(poi);
		console.log('[selectPoi] id:', current.id, 'poi:', snap);
		uploadsTotal++;
		uploadQueue.push({ imageId: current.id, poi: snap });
		drainQueue();
		next();
	}

	async function drainQueue() {
		if (uploadRunning) return;
		uploadRunning = true;
		while (uploadQueue.length > 0) {
			const { imageId, poi } = uploadQueue.shift()!;
			await uploadImageRecord(imageId, poi);
		}
		uploadRunning = false;
	}

	async function uploadImageRecord(imageId: string, poi: POI) {
		console.log('[upload] start', imageId);
		try {
			await updateImage(imageId, { status: 'uploading', poi });
			console.log('[upload] saved poi to IDB');
			const image = await getImage(imageId);
			if (!image) throw new Error('Image not found');
			const blob = storedImageToBlob(image);
			console.log('[upload] got image from IDB, file size:', blob.size);
			const { blob: compressed, aspectRatio } = await compressImage(blob);
			console.log('[upload] compressed:', compressed.size, 'bytes, aspect:', aspectRatio);
			const blobInfo = await uploadBlob({ blob: compressed });
			console.log('[upload] blob uploaded:', blobInfo);
			if (!blobInfo) throw new Error('uploadBlob returned undefined');
			const rkey = `${createTID()}`;
			const record: Record<string, unknown> = {
				$type: MAIN_COLLECTION,
				images: [
					{
						image: blobInfo,
						aspectRatio: {
							width: Math.round(aspectRatio.width),
							height: Math.round(aspectRatio.height)
						}
					}
				],
				location: [
					{
						$type: 'community.lexicon.location.geo',
						latitude: poi.latitude,
						longitude: poi.longitude
					}
				],
				name: poi.name,
				mainPoiUri: {
					uri:
						poi.osmType && poi.osmId
							? `osm://${poi.osmType}/${poi.osmId}`
							: `geo:${poi.latitude},${poi.longitude}`
				},
				license: 'CC0'
			};
			console.log('[upload] putRecord rkey:', rkey, 'record:', record);
			await putRecord({
				collection: MAIN_COLLECTION,
				rkey,
				record
			});
			console.log('[upload] putRecord done');
			await updateImage(imageId, { status: 'done' });
			console.log('[upload] complete', imageId);
		} catch (e) {
			console.error('[upload] failed:', e);
			await updateImage(imageId, { status: 'error' });
		} finally {
			uploadsDone++;
			console.log('[upload] progress:', uploadsDone, '/', uploadsTotal);
		}
	}

	function skip() {
		deleteImage(current.id);
		next();
	}

	function next() {
		if (currentIndex < images.length - 1) {
			currentIndex++;
			query = '';
			nearbyPois = [];
			nearbyError = false;
			searchCenter = null;
			const img = images[currentIndex];
			if (img.exifGps) {
				loadNearby(img.exifGps.latitude, img.exifGps.longitude, img.id);
			}
		} else {
			done = true;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (
			e.key === 'p' &&
			!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
		) {
			showImageOverlay = !showImageOverlay;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if done && uploading}
	<div
		class="bg-base-50 dark:bg-base-950 flex h-dvh flex-col items-center justify-center gap-6 px-6"
	>
		<h1 class="text-base-900 dark:text-base-50 text-2xl font-bold">Uploading...</h1>
		<p class="text-base-500 dark:text-base-400 text-sm">{uploadsDone}/{uploadsTotal}</p>
	</div>
{:else if done}
	<div class="flex h-screen w-screen flex-col items-center justify-center">
		<span class="text-xl font-semibold">All images uploaded.</span>

		<a
			href={'/map/' + user.profile?.handle}
			class="bg-accent-600 hover:bg-accent-500 mt-10 cursor-pointer rounded-full px-12 py-5 text-lg font-bold text-white shadow-lg transition-all active:scale-95"
		>
			See them on the map
		</a>
	</div>
{:else if current}
	<div class="bg-base-50 dark:bg-base-950 relative flex h-dvh flex-col lg:flex-row">
		<!-- Left column: search + POI list -->
		<div class="flex flex-1 flex-col overflow-hidden lg:max-w-md">
			<!-- Header: image preview + counter (mobile only) -->
			<div
				class="border-base-200 dark:border-base-800 flex items-center gap-4 border-b px-4 py-3 lg:hidden"
			>
				{#if previewUrls.get(current.id)}
					<button type="button" onclick={() => (showImageOverlay = true)} class="shrink-0">
						<img
							src={previewUrls.get(current.id)}
							alt=""
							class="h-14 w-14 rounded-lg object-cover"
						/>
					</button>
				{/if}
				<span class="text-base-600 dark:text-base-400 text-sm font-bold">
					{currentIndex + 1}/{total}
				</span>
				{#if current.exifGps}
					<span class="text-[10px] font-semibold text-green-600 dark:text-green-400">GPS</span>
				{/if}
				{#if uploading}
					<span class="text-base-400 dark:text-base-500 ml-auto text-[10px] font-semibold">
						uploading {Math.round((uploadsDone / uploadsTotal) * 100)}%
					</span>
				{/if}
			</div>

			<Command.Root shouldFilter={false} class="flex flex-1 flex-col overflow-hidden">
				<!-- Search bar -->
				<div class="flex flex-col gap-3 px-4 py-3">
					<div class="relative">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="text-base-400 absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
							/>
						</svg>
						<Command.Input
							placeholder="Search for a place..."
							class="border-base-300 text-base-900 placeholder-base-400 focus:border-accent-500 dark:border-base-600 dark:bg-base-900 dark:text-base-100 dark:placeholder-base-500 w-full rounded-xl border bg-white py-2.5 pr-4 pl-9 text-sm focus:outline-none"
							bind:value={query}
						/>
					</div>

					<!-- Action buttons -->
					<div class="flex gap-2">
						<button
							type="button"
							class="text-base-700 ring-base-200 hover:bg-base-100 dark:bg-base-900 dark:text-base-300 dark:ring-base-700 dark:hover:bg-base-800 flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold shadow-sm ring-1 active:scale-[0.98]"
							onclick={() => {
								navigator.geolocation.getCurrentPosition(
									(pos) => loadNearby(pos.coords.latitude, pos.coords.longitude),
									(err) => console.error('Geolocation error:', err)
								);
							}}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4 text-blue-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
								/>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
								/>
							</svg>
							Nearby
						</button>
						<button
							type="button"
							class="text-base-700 ring-base-200 hover:bg-base-100 dark:bg-base-900 dark:text-base-300 dark:ring-base-700 dark:hover:bg-base-800 flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold shadow-sm ring-1 active:scale-[0.98]"
							onclick={() => (showMapPicker = true)}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4 text-orange-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
								/>
							</svg>
							Pick on map
						</button>
					</div>
				</div>

				{#if searchCenter}
					<div class="flex items-center gap-1.5 px-4">
						<span class="text-base-400 dark:text-base-500 text-xs">
							searching near {searchCenter.lat.toFixed(4)}, {searchCenter.lng.toFixed(4)}
						</span>
						<button
							type="button"
							aria-label="Clear search location"
							class="text-base-400 hover:text-base-600 dark:text-base-500 dark:hover:text-base-300"
							onclick={clearSearch}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3.5 w-3.5"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
								/>
							</svg>
						</button>
					</div>
				{/if}

				<!-- Progress bar -->
				{#if showProgress}
					<div class="bg-base-200 dark:bg-base-800 h-1 w-full overflow-hidden">
						<div
							class="bg-accent-600 h-full ease-out"
							style="width: {progress}%; transition: width {progressDuration} ease-out;"
						></div>
					</div>
				{/if}

				<!-- POI list -->
				<Command.List class="flex-1 overflow-y-auto px-4 pb-4">
					{#if loading && pois.length === 0}
						<Command.Loading class="text-base-500 py-8 text-center text-sm font-medium">
							Loading places...
						</Command.Loading>
					{/if}

					{#if !loading && pois.length === 0 && (query.length >= 2 || searchCenter)}
						<Command.Empty class="flex flex-col items-center gap-3 py-8">
							<span class="text-base-400 text-sm">No places found.</span>
							{#if nearbyError && searchCenter}
								<button
									type="button"
									class="text-accent-600 hover:text-accent-500 text-xs font-semibold"
									onclick={() => {
										if (searchCenter) loadNearby(searchCenter.lat, searchCenter.lng);
									}}
								>
									Retry
								</button>
							{/if}
						</Command.Empty>
					{/if}

					{#each sortedPois as poi (poi.name + poi.latitude + poi.longitude)}
						{@const dist = searchCenter
							? distanceKm(
									searchCenter.lat,
									searchCenter.lng,
									Number(poi.latitude),
									Number(poi.longitude)
								)
							: null}
						<Command.Item
							value="{poi.name} {poi.latitude},{poi.longitude}"
							keywords={[
								poi.category,
								poi.address,
								poi.category !== 'place' ? poi.category : ''
							].filter(Boolean)}
							onSelect={() => selectPoi(poi)}
							onmouseenter={() => (hoveredPoi = poi)}
							onmouseleave={() => (hoveredPoi = null)}
							class="ring-base-100 hover:bg-base-100 hover:ring-base-300 data-selected:bg-base-100 data-selected:ring-base-300 dark:bg-base-900 dark:ring-base-800 dark:hover:bg-base-800 dark:data-selected:bg-base-800 mb-1.5 flex w-full cursor-pointer items-baseline gap-2 rounded-xl bg-white px-4 py-3 text-left shadow-sm ring-1 transition-colors"
						>
							<span class="text-base-900 dark:text-base-100 text-sm font-bold">{poi.name}</span>
							{#if poi.category && poi.category !== 'place'}
								<span
									class="bg-base-100 text-base-500 dark:bg-base-800 dark:text-base-400 rounded-full px-2 py-0.5 text-[10px] font-bold"
									>{poi.category}</span
								>
							{/if}
							<span class="ml-auto flex items-center gap-2">
								{#if dist !== null && !isNaN(dist)}
									<span class="text-base-400 dark:text-base-500 text-[10px] font-semibold"
										>{formatDist(dist)}</span
									>
								{/if}
							</span>
						</Command.Item>
					{/each}
				</Command.List>
			</Command.Root>

			<div class="flex items-center justify-between px-4 py-3">
				<AddImagesButton>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class={'h-4 w-4'}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
				</AddImagesButton>

				<button
					type="button"
					class="text-base-400 hover:text-base-600 dark:text-base-500 dark:hover:text-base-300 text-xs font-semibold"
					onclick={skip}
				>
					Skip
				</button>
			</div>
		</div>

		<!-- Right column: desktop only — image preview + map -->
		<div class="border-base-200 dark:border-base-800 hidden flex-col border-l lg:flex lg:flex-1">
			<div class="border-base-200 dark:border-base-800 border-b p-4">
				<div class="flex items-center gap-3">
					{#if previewUrls.get(current.id)}
						<button type="button" onclick={() => (showImageOverlay = true)} class="shrink-0">
							<img
								src={previewUrls.get(current.id)}
								alt=""
								class="h-60 w-60 rounded-xl object-cover"
							/>
						</button>
					{/if}
					<div class="flex flex-col gap-1">
						<span class="text-base-600 dark:text-base-400 text-sm font-bold">
							{currentIndex + 1}/{total}
						</span>
						{#if current.exifGps}
							<span class="text-[10px] font-semibold text-green-600 dark:text-green-400">GPS</span>
						{/if}
						{#if uploading}
							<span class="text-base-400 dark:text-base-500 text-[10px] font-semibold">
								uploading {Math.round((uploadsDone / uploadsTotal) * 100)}%
							</span>
						{/if}
					</div>
				</div>
			</div>
			<div class="flex-1">
				<UploadMap center={mapCenter} pois={sortedPois} {hoveredPoi} onselect={selectPoi} />
			</div>
		</div>
	</div>

	{#if showMapPicker}
		<div class="absolute inset-0 z-20">
			<MapPicker
				initialCenter={searchCenter ??
					(current?.exifGps
						? { lat: current.exifGps.latitude, lng: current.exifGps.longitude }
						: undefined)}
				onpick={(coords) => {
					showMapPicker = false;
					loadNearby(coords.latitude, coords.longitude);
				}}
				oncancel={() => (showMapPicker = false)}
			/>
		</div>
	{/if}

	{#if showImageOverlay && previewUrls.get(current.id)}
		<ImageOverlay src={previewUrls.get(current.id)!} onclose={() => (showImageOverlay = false)} />
	{/if}
{/if}
