<script lang="ts">
	import type { Voice } from '$lib/types';

	interface Props {
		voice: Voice;
		isPrimary?: boolean;
		showFullName?: boolean;
		size?: 'sm' | 'md';
		removable?: boolean;
		onRemove?: () => void;
		disabled?: boolean;
		class?: string;
	}

	let {
		voice,
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
		? `${voice.name} (${voice.abbreviation})` 
		: voice.abbreviation);
</script>

<span
	class="inline-flex items-center gap-1 bg-purple-100 font-medium text-purple-800 {sizeClasses[size]} {removable ? 'group relative' : ''} {className}"
	title="{voice.name}{isPrimary ? ' (primary)' : ''}"
>
	{#if isPrimary}★{/if}
	{displayText}
	{#if removable && onRemove && !disabled}
		<button
			onclick={onRemove}
			class="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-purple-900 transition"
			title="Remove {voice.name}"
		>
			×
		</button>
	{/if}
</span>
