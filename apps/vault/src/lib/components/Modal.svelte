<script lang="ts">
	/**
	 * Reusable Modal component with standardized behavior:
	 * - ESC key to close
	 * - Click outside (backdrop) to close
	 * - Proper ARIA attributes for accessibility
	 * - Focus trap ready (tabindex=-1)
	 */

	interface Props {
		open: boolean;
		title: string;
		onclose: () => void;
		maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
		children: import('svelte').Snippet;
	}

	let { open, title, onclose, maxWidth = 'md', children }: Props = $props();

	const widthClasses: Record<string, string> = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-xl'
	};

	// Track where mousedown started to prevent closing on drag-out
	let mouseDownTarget: EventTarget | null = null;

	function handleMouseDown(e: MouseEvent) {
		mouseDownTarget = e.target;
	}

	function handleMouseUp(e: MouseEvent) {
		// Only close if both mousedown and mouseup were on the backdrop itself
		if (e.target === e.currentTarget && mouseDownTarget === e.currentTarget) {
			onclose();
		}
		mouseDownTarget = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}

	// Generate unique ID for aria-labelledby
	const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-labelledby={titleId}
		tabindex="-1"
		onmousedown={handleMouseDown}
		onmouseup={handleMouseUp}
		onkeydown={handleKeydown}
	>
		<div class="max-h-[90vh] w-full {widthClasses[maxWidth]} overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
			<h2 id={titleId} class="mb-4 text-xl font-semibold">{title}</h2>
			{@render children()}
		</div>
	</div>
{/if}
