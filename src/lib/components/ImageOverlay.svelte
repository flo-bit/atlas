<script lang="ts">
	import { fade } from 'svelte/transition';

	interface Props {
		src: string;
		onclose: () => void;
	}

	let { src, onclose }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
	transition:fade={{ duration: 200 }}
	onclick={onclose}
	onkeydown={handleKeydown}
	role="dialog"
	aria-modal="true"
	tabindex="-1"
>
	<img {src} alt="" class="max-h-full max-w-full object-contain" />
</div>
