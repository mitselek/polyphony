<script lang="ts">
	/**
	 * Test wrapper for SortableList component
	 * Provides proper Svelte 5 snippet for testing
	 */
	import SortableList from './SortableList.svelte';

	interface Item {
		id: string;
		name: string;
		[key: string]: unknown;
	}

	interface Props {
		items: Item[];
		onReorder: (itemIds: string[]) => void;
		disabled?: boolean;
		showHandle?: boolean;
	}

	let { items, onReorder, disabled = false, showHandle = true }: Props = $props();
</script>

<SortableList {items} {onReorder} {disabled} {showHandle}>
	{#snippet item(itemData, index)}
		<div data-testid="item-{itemData.id}" class="test-item">
			<span class="item-name">{itemData.name}</span>
			<span class="item-index">{index}</span>
		</div>
	{/snippet}
</SortableList>
