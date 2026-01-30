<script lang="ts">
	/**
	 * Reusable drag-and-drop sortable list component
	 * 
	 * Usage:
	 * <SortableList items={myItems} onReorder={handleReorder}>
	 *   {#snippet item(item, index)}
	 *     <div>
	 *       <span>{item.name}</span>
	 *     </div>
	 *   {/snippet}
	 * </SortableList>
	 * 
	 * Props:
	 * - items: Array of items with unique 'id' property
	 * - onReorder: Callback with new order of item IDs
	 * - disabled: Disable drag functionality
	 * - showHandle: Show drag handle (default: true)
	 * 
	 * Snippets:
	 * - item: Render function for each item (item, index)
	 */
	import type { Snippet } from 'svelte';

	interface Item {
		id: string;
		[key: string]: unknown;
	}

	interface Props {
		items: Item[];
		onReorder: (itemIds: string[]) => void | Promise<void>;
		disabled?: boolean;
		showHandle?: boolean;
		item: Snippet<[Item, number]>;
	}

	let { items, onReorder, disabled = false, showHandle = true, item: itemSnippet }: Props = $props();

	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);
	let isDragging = $state(false);

	function handleDragStart(e: DragEvent, index: number) {
		if (disabled) return;
		draggedIndex = index;
		isDragging = true;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', index.toString());
		}
	}

	function handleDragOver(e: DragEvent, index: number) {
		if (disabled || draggedIndex === null) return;
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dragOverIndex = index;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDrop(e: DragEvent, dropIndex: number) {
		e.preventDefault();
		if (disabled || draggedIndex === null || draggedIndex === dropIndex) {
			resetDragState();
			return;
		}

		// Reorder items
		const newItems = [...items];
		const [removed] = newItems.splice(draggedIndex, 1);
		newItems.splice(dropIndex, 0, removed);

		// Call onReorder with new ID order
		const newOrder = newItems.map(item => item.id);
		onReorder(newOrder);

		resetDragState();
	}

	function handleDragEnd() {
		resetDragState();
	}

	function resetDragState() {
		draggedIndex = null;
		dragOverIndex = null;
		isDragging = false;
	}

	// Move item up/down with buttons (accessibility)
	function moveItem(index: number, direction: 'up' | 'down') {
		if (disabled) return;
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= items.length) return;

		const newItems = [...items];
		[newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
		const newOrder = newItems.map(item => item.id);
		onReorder(newOrder);
	}
</script>

<div class="sortable-list space-y-2">
	{#each items as itemData, index (itemData.id)}
		<div
			class="sortable-item flex items-start gap-2 transition-all duration-150
				{draggedIndex === index ? 'opacity-50' : ''}
				{dragOverIndex === index && draggedIndex !== index ? 'border-t-2 border-blue-500' : ''}"
			ondragover={(e) => handleDragOver(e, index)}
			ondragleave={handleDragLeave}
			ondrop={(e) => handleDrop(e, index)}
			role="listitem"
		>
			{#if showHandle && !disabled}
				<div class="flex flex-col items-center gap-0.5 pt-2">
					<button
						type="button"
						onclick={() => moveItem(index, 'up')}
						disabled={index === 0}
						class="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
						title="Move up"
						aria-label="Move up"
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
						</svg>
					</button>
					<span
						class="cursor-grab p-0.5 text-gray-400 hover:text-gray-600"
						title="Drag to reorder"
						aria-label="Drag handle"
						draggable="true"
						ondragstart={(e) => handleDragStart(e, index)}
						ondragend={handleDragEnd}
						role="button"
						tabindex="0"
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
						</svg>
					</span>
					<button
						type="button"
						onclick={() => moveItem(index, 'down')}
						disabled={index === items.length - 1}
						class="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
						title="Move down"
						aria-label="Move down"
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
						</svg>
					</button>
				</div>
			{/if}
			<div class="flex-1">
				{@render itemSnippet(itemData, index)}
			</div>
		</div>
	{/each}
</div>

<style>
	.sortable-item {
		touch-action: none;
	}
</style>
