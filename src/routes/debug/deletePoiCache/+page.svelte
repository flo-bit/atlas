<script lang="ts">
	import { goto } from '$app/navigation';
	import { clearPOICache } from '$lib/state/poi-cache';

	let deleted = $state(false);

	async function deletePOICache() {
		await clearPOICache();
		deleted = true;
	}
</script>

{#if deleted}
	<div class="flex h-dvh flex-col items-center justify-center gap-4 px-6">
		<p class="text-base-600 dark:text-base-400 text-sm font-medium">POI cache cleared.</p>
		<button
			type="button"
			class="bg-accent-600 hover:bg-accent-500 rounded-xl px-6 py-3 text-sm font-bold text-white active:scale-95"
			onclick={() => goto('/')}
		>
			Go home
		</button>
	</div>
{:else}
	<div class="flex h-dvh flex-col items-center justify-center gap-4 px-6">
		<p class="text-base-500 dark:text-base-400 text-sm">This will clear all cached POI results.</p>
		<button
			type="button"
			class="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-500 active:scale-95"
			onclick={deletePOICache}
		>
			Clear cache
		</button>
	</div>
{/if}
