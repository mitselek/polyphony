<script lang="ts">
	/**
	 * Base Card component - single source of truth for card styling
	 * 
	 * Variants:
	 * - 'static': Non-interactive display card
	 * - 'clickable': Entire card is a link (uses <a> tag)
	 * - 'interactive': Static card with action buttons inside
	 * 
	 * Props:
	 * - variant: Card behavior type
	 * - href: Link destination (required for 'clickable' variant)
	 * - padding: Padding size ('sm' | 'md' | 'lg')
	 * - class: Additional CSS classes
	 * 
	 * Slots:
	 * - default: Card content
	 * - actions: Optional action buttons (for 'interactive' variant)
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'static' | 'clickable' | 'interactive';
		href?: string;
		padding?: 'sm' | 'md' | 'lg';
		class?: string;
		children: Snippet;
		actions?: Snippet;
	}

	let { 
		variant = 'static', 
		href = '', 
		padding = 'md',
		class: className = '',
		children,
		actions
	}: Props = $props();

	// Base styles - single source of truth
	const baseClasses = 'rounded-lg border border-gray-200 bg-white shadow-sm';
	
	// Padding variants
	const paddingClasses = {
		sm: 'p-3',
		md: 'p-4',
		lg: 'p-6'
	};

	// Variant-specific styles
	const variantClasses = {
		static: '',
		clickable: 'block transition hover:border-blue-300 hover:shadow-md group',
		interactive: ''
	};

	// Combined classes
	let cardClasses = $derived(
		`${baseClasses} ${paddingClasses[padding]} ${variantClasses[variant]} ${className}`.trim()
	);
</script>

{#if variant === 'clickable' && href}
	<a {href} class={cardClasses}>
		{@render children()}
		{#if actions}
			<!-- Actions in clickable cards need stopPropagation wrapper -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div 
				class="card-actions"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
				role="group"
			>
				{@render actions()}
			</div>
		{/if}
	</a>
{:else}
	<div class={cardClasses}>
		{@render children()}
		{#if actions}
			<div class="card-actions">
				{@render actions()}
			</div>
		{/if}
	</div>
{/if}
