<script lang="ts">
	/**
	 * Reusable drag-and-drop sortable list component
	 * 
	 * Usage:
	 * <SortableList items={myItems} onReorder={handleReorder}>
	 *   {#snippet item(item, index, dragHandle)}
	 *     <div>
	 *       {@render dragHandle()}
	 *       <span>{item.name}</span>
	 *     </div>
	 *   {/snippet}
	 * </SortableList>
	 * 
	 * Props:
	 * - items: Array of items with unique 'id' property
	 * - onReorder: Callback with new order of item IDs
	 * - disabled: Disable drag functionality
	 * 
	 * Snippets:
	 * - item: Render function for each item (item, index, dragHandle snippet)
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
		item: Snippet<[Item, number, Snippet]>;
	}

	let { items, onReorder, disabled = false, item: itemSnippet }: Props = $props();

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

{#snippet dragHandle(index: number)}
	<div class="flex items-center gap-1">
		<button
			type="button"
			onclick={() => moveItem(index, 'up')}
			disabled={disabled || index === 0}
			class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
			title="Move up"
			aria-label="Move up"
		>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
			</svg>
		</button>
		<button
			type="button"
			onclick={() => moveItem(index, 'down')}
			disabled={disabled || index === items.length - 1}
			class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
			title="Move down"
			aria-label="Move down"
		>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
				<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
			</svg>
		</button>
		<span
			class="cursor-grab p-1 text-gray-400 hover:text-gray-600 {disabled ? 'cursor-not-allowed opacity-30' : ''}"
			title="Drag to reorder"
			aria-label="Drag handle"
			draggable={!disabled}
			ondragstart={(e) => handleDragStart(e, index)}
			ondragend={handleDragEnd}
			role="button"
			tabindex={disabled ? -1 : 0}
		>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
			</svg>
		</span>
	</div>
{/snippet}

<div class="sortable-list space-y-2">
	{#each items as itemData, index (itemData.id)}
		<div
			class="sortable-item transition-all duration-150
				{draggedIndex === index ? 'opacity-50' : ''}
				{dragOverIndex === index && draggedIndex !== index ? 'border-t-2 border-blue-500' : ''}"
			ondragover={(e) => handleDragOver(e, index)}
			ondragleave={handleDragLeave}
			ondrop={(e) => handleDrop(e, index)}
			role="listitem"
		>
			{@render itemSnippet(itemData, index, () => dragHandle(index))}
		</div>
	{/each}
</div>

<style>
	.sortable-item {
		touch-action: none;
	}
</style>
