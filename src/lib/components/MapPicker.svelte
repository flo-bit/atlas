<script lang="ts">
	import { MapLibre, Marker } from 'svelte-maplibre-gl';

	interface Props {
		onpick: (coords: { latitude: number; longitude: number }) => void;
		oncancel: () => void;
		initialCenter?: { lat: number; lng: number };
	}

	let { onpick, oncancel, initialCenter }: Props = $props();

	let picked = $state<{ lng: number; lat: number } | null>(null);

	function handleClick(e: maplibregl.MapMouseEvent) {
		picked = { lng: e.lngLat.lng, lat: e.lngLat.lat };
	}

	function confirm() {
		if (picked) {
			onpick({ latitude: picked.lat, longitude: picked.lng });
		}
	}
</script>

<div class="relative h-full w-full">
	<MapLibre
		class="h-full w-full"
		style="https://tiles.openfreemap.org/styles/liberty"
		zoom={initialCenter ? 13 : 2}
		center={initialCenter
			? { lng: initialCenter.lng, lat: initialCenter.lat }
			: { lng: 0, lat: 20 }}
		onclick={handleClick}
	>
		{#if initialCenter && !picked}
			<Marker lnglat={[initialCenter.lng, initialCenter.lat]}>
				{#snippet content()}
					<div class="h-3 w-3 rounded-full border-2 border-white bg-blue-500 shadow-md"></div>
				{/snippet}
			</Marker>
		{/if}
		{#if picked}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<Marker lnglat={[picked.lng, picked.lat]}>
				{#snippet content()}
					<div
						class="cursor-pointer"
						onclick={confirm}
						onkeydown={(e) => {
							if (e.key === 'Enter') confirm();
						}}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="text-accent-600 h-8 w-8 -translate-y-4 drop-shadow-lg"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
				{/snippet}
			</Marker>
		{/if}
	</MapLibre>

	<!-- handy for debug  -->
	<!-- <div class="absolute left-4 top-4 flex gap-2">
		<button
			type="button"
			class="rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-base-700 shadow-lg backdrop-blur-sm hover:bg-white active:scale-95 dark:bg-base-800/90 dark:text-base-200 dark:hover:bg-base-800"
			onclick={oncancel}
		>
			Cancel
		</button>
		{#if picked || initialCenter}
			{@const loc = picked ?? initialCenter!}
			<a
				href="https://www.openstreetmap.org/?mlat={loc.lat}&mlon={loc.lng}#map=17/{loc.lat}/{loc.lng}"
				target="_blank"
				rel="noopener noreferrer"
				class="rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-base-700 shadow-lg backdrop-blur-sm hover:bg-white active:scale-95 dark:bg-base-800/90 dark:text-base-200 dark:hover:bg-base-800"
			>
				Open in OSM
			</a>
		{/if}
	</div> -->

	<div class="absolute bottom-8 left-1/2 -translate-x-1/2">
		{#if picked}
			<button
				type="button"
				class="bg-accent-600 hover:bg-accent-500 rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg active:scale-95"
				onclick={confirm}
			>
				Use this location
			</button>
		{:else}
			<div
				class="rounded-full bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm"
			>
				Tap to place a pin
			</div>
		{/if}
	</div>
</div>
