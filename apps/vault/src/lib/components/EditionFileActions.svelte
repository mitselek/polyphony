<script lang="ts">
	/**
	 * Reusable component for View/Download buttons on editions
	 * Single source of truth for file access UI
	 * 
	 * Props:
	 * - editionId: The edition ID
	 * - fileKey: Whether edition has an uploaded file (truthy = has file)
	 * - externalUrl: Optional external URL for the file
	 * - size: 'sm' | 'md' - button size variant
	 * - stopPropagation: Whether to stop click propagation (for clickable parent containers)
	 */

	interface Props {
		editionId: string;
		fileKey: string | null;
		externalUrl?: string | null;
		size?: 'sm' | 'md';
		stopPropagation?: boolean;
	}

	let { editionId, fileKey, externalUrl = null, size = 'sm', stopPropagation = false }: Props = $props();

	// URL patterns - single source of truth
	let viewUrl = $derived(`/editions/${editionId}/view`);
	let downloadUrl = $derived(`/api/editions/${editionId}/file?download=1`);

	// Size-based styling
	let buttonClasses = $derived(
		size === 'sm'
			? 'px-2 py-1 text-xs'
			: 'px-4 py-2 text-sm'
	);

	// Handle click with optional stopPropagation
	function handleClick(e: MouseEvent, url: string) {
		if (stopPropagation) {
			e.preventDefault();
			e.stopPropagation();
			window.location.href = url;
		}
	}

	function handleKeydown(e: KeyboardEvent, url: string) {
		if (e.key === 'Enter' && stopPropagation) {
			e.preventDefault();
			e.stopPropagation();
			window.location.href = url;
		}
	}
</script>

{#if fileKey}
	<div class="flex items-center gap-2">
		{#if stopPropagation}
			<span
				onclick={(e) => handleClick(e, viewUrl)}
				onkeydown={(e) => handleKeydown(e, viewUrl)}
				role="link"
				tabindex="0"
				class="cursor-pointer inline-flex items-center gap-1 rounded border border-blue-600 bg-white font-medium text-blue-600 hover:bg-blue-50 transition {buttonClasses}"
			>
				View
			</span>
			<span
				onclick={(e) => handleClick(e, downloadUrl)}
				onkeydown={(e) => handleKeydown(e, downloadUrl)}
				role="link"
				tabindex="0"
				class="cursor-pointer inline-flex items-center gap-1 rounded border border-gray-300 bg-white font-medium text-gray-600 hover:bg-gray-50 transition {buttonClasses}"
			>
				Download
			</span>
		{:else}
			<a
				href={viewUrl}
				class="inline-flex items-center gap-1 rounded border border-blue-600 bg-white font-medium text-blue-600 hover:bg-blue-50 transition {buttonClasses}"
			>
				View
			</a>
			<a
				href={downloadUrl}
				class="inline-flex items-center gap-1 rounded border border-gray-300 bg-white font-medium text-gray-600 hover:bg-gray-50 transition {buttonClasses}"
			>
				Download
			</a>
		{/if}
	</div>
{:else if externalUrl}
	<a
		href={externalUrl}
		target="_blank"
		rel="noopener noreferrer"
		class="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition"
	>
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
			<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
		</svg>
		View Online
	</a>
{/if}
