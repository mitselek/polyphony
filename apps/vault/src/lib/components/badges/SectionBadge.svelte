<script lang="ts">
	import type { Section } from '$lib/types';

	interface Props {
		section: Section;
		isPrimary?: boolean;
		showFullName?: boolean;
		size?: 'sm' | 'md';
		removable?: boolean;
		onRemove?: () => void;
		disabled?: boolean;
		class?: string;
	}

	let {
		section,
		isPrimary = false,
		showFullName = false,
		size = 'sm',
		removable = false,
		onRemove,
		disabled = false,
		class: className = ''
	}: Props = $props();

	const sizeClasses = {
		sm: 'rounded px-2 py-0.5 text-xs',
		md: 'rounded-full px-3 py-1 text-sm'
	};

	let displayText = $derived(showFullName 
		? `${section.name} (${section.abbreviation})` 
		: section.abbreviation);
</script>

<span
	class="inline-flex items-center gap-1 bg-teal-100 font-medium text-teal-800 {sizeClasses[size]} {removable ? 'group relative' : ''} {className}"
	title="{section.name}{isPrimary ? ' (primary)' : ''}"
>
	{#if isPrimary}★{/if}
	{displayText}
	{#if removable && onRemove && !disabled}
		<button
			onclick={onRemove}
			class="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-teal-900 transition"
			title="Remove {section.name}"
		>
			×
		</button>
	{/if}
</span>
