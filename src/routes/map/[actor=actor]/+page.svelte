<script lang="ts">
	import { MapLibre, Marker, Popup, Projection } from 'svelte-maplibre-gl';
	import { getImageFromRecord } from '$lib/atproto/image-helper';
	import { getLocationFromRecord, getLocationLabel, hasLocation } from '$lib/poi';
	import AddImagesButton from '$lib/components/AddImagesButton.svelte';

	let { data } = $props();

	let geoImages = $derived(
		data.records.filter((img) => hasLocation(img.value as Record<string, unknown>))
	);
</script>

<div class="relative h-dvh w-full overflow-hidden">
	<MapLibre
		class="h-full w-full"
		style="https://tiles.openfreemap.org/styles/liberty"
		zoom={2}
		center={{ lng: 0, lat: 0 }}
	>
		<Projection type={'globe'} />

		{#each geoImages as img (img.uri)}
			{@const loc = getLocationFromRecord(img.value as Record<string, unknown>)}
			{#if loc}
				{@const lat = Number(loc.latitude)}
				{@const lng = Number(loc.longitude)}
				{@const thumbUrl = getImageFromRecord(img.value, data.did)}
				{@const label = getLocationLabel(img.value as Record<string, unknown>)}

				<Marker lnglat={[lng, lat]}>
					{#snippet content()}
						<img
							src={thumbUrl}
							class="size-10 cursor-pointer rounded-xl border-2 border-white"
							alt=""
						/>
					{/snippet}
					<Popup offset={25}>
						<div class="max-w-50 text-center">
							{#if thumbUrl}
								<img src={thumbUrl} alt="" class="mb-2 w-full rounded-md" />
							{/if}
							<div class="text-base-900 text-sm">{label}</div>
						</div>
					</Popup>
				</Marker>
			{/if}
		{/each}
	</MapLibre>

	<div class="absolute bottom-8 left-4 z-10">
		<AddImagesButton>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class={'h-6 w-6'}
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
		</AddImagesButton>
	</div>
</div>
