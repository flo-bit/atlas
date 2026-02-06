<script lang="ts">
	import { goto } from '$app/navigation';
	import { clearImages } from '$lib/state/image-store.svelte';

	let deleted = $state(false);

	async function deleteAll() {
		await clearImages();
		deleted = true;
	}
</script>

{#if deleted}
	<div class="flex h-dvh flex-col items-center justify-center gap-4 px-6">
		<p class="text-base-600 dark:text-base-400 text-sm font-medium">All images deleted.</p>
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
		<p class="text-base-500 dark:text-base-400 text-sm">
			This will delete all images from local storage.
		</p>
		<button
			type="button"
			class="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-500 active:scale-95"
			onclick={deleteAll}
		>
			Delete all
		</button>
	</div>
{/if}
