<script lang="ts">
	import { MapLibre, Marker, Popup } from 'svelte-maplibre-gl';
	import type { POI } from '$lib/poi';

	interface Props {
		center: { lat: number; lng: number } | null;
		pois: POI[];
		hoveredPoi: POI | null;
		onselect: (poi: POI) => void;
	}

	let { center, pois, hoveredPoi, onselect }: Props = $props();

	function isHovered(poi: POI): boolean {
		if (!hoveredPoi) return false;
		return (
			poi.name === hoveredPoi.name &&
			poi.latitude === hoveredPoi.latitude &&
			poi.longitude === hoveredPoi.longitude
		);
	}
</script>

{#if center}
	<div class="h-full w-full">
		<MapLibre
			class="h-full w-full"
			style="https://tiles.openfreemap.org/styles/liberty"
			zoom={15}
			center={{ lng: center.lng, lat: center.lat }}
		>
			<!-- Image GPS position: blue dot -->
			<Marker lnglat={[center.lng, center.lat]}>
				{#snippet content()}
					<div class="h-3 w-3 rounded-full border-2 border-white bg-blue-500 shadow-md"></div>
				{/snippet}
			</Marker>

			<!-- POI markers -->
			{#each pois as poi (poi.name + poi.latitude + poi.longitude)}
				{@const lng = Number(poi.longitude)}
				{@const lat = Number(poi.latitude)}
				{@const hovered = isHovered(poi)}

				<Marker lnglat={[lng, lat]}>
					{#snippet content()}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="cursor-pointer rounded-full border-2 border-white shadow-sm transition-all {hovered
								? 'h-3.5 w-3.5 bg-rose-400'
								: 'h-2 w-2 bg-rose-500'}"
							onclick={() => onselect(poi)}
							onkeydown={(e) => {
								if (e.key === 'Enter') onselect(poi);
							}}
						></div>
					{/snippet}
					{#if hovered}
						<Popup offset={10}>
							<div class="text-base-900 px-1 text-sm font-medium">{poi.name}</div>
						</Popup>
					{/if}
				</Marker>
			{/each}
		</MapLibre>
	</div>
{/if}
