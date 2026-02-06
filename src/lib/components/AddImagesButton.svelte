<script lang="ts">
	import { goto } from '$app/navigation';
	import { user } from '$lib/atproto';
	import { saveImage } from '$lib/state/image-store.svelte';
	import { extractGpsBatch } from '$lib/image/exif';
	import type { Snippet } from 'svelte';

	let {
		class: className,
		children
	}: {
		class?: string;
		children?: Snippet;
	} = $props();

	let fileInput: HTMLInputElement | undefined = $state();

	async function handleFiles(files: FileList | File[]) {
		const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
		if (arr.length === 0 || !user.isLoggedIn) return;

		const gpsResults = await extractGpsBatch(arr);

		await Promise.all(
			arr.map(async (file, i) =>
				saveImage({
					id: crypto.randomUUID(),
					fileData: await file.arrayBuffer(),
					fileType: file.type,
					filename: file.name,
					exifGps: gpsResults[i],
					poi: null,
					status: 'pending',
					createdAt: Date.now()
				})
			)
		);

		goto('/upload');
	}

	function handleFileInput(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files) handleFiles(input.files);
		input.value = '';
	}
</script>

{#if user.isLoggedIn}
	<button
		type="button"
		class={[
			'bg-accent-600 hover:bg-accent-500 flex cursor-pointer items-center justify-center rounded-full p-4 text-white shadow-lg transition-all active:scale-95',
			className
		]}
		onclick={() => fileInput?.click()}
		aria-label="Upload images"
	>
		{@render children?.()}
	</button>

	<input
		type="file"
		accept="image/*"
		multiple
		class="hidden"
		bind:this={fileInput}
		onchange={handleFileInput}
	/>
{/if}
