<!-- Toast notification component -->
<!-- Displays stacked toast notifications from the toast store -->
<script lang="ts">
	import { toast, type Toast } from '$lib/stores/toast';
	import { fly, fade } from 'svelte/transition';

	// Subscribe to toast store
	let toasts: Toast[] = $state([]);
	toast.subscribe((value) => {
		toasts = value;
	});

	function getToastClasses(type: Toast['type']): string {
		switch (type) {
			case 'success':
				return 'bg-green-100 text-green-800 border-green-200';
			case 'error':
				return 'bg-red-100 text-red-800 border-red-200';
			case 'info':
				return 'bg-blue-100 text-blue-800 border-blue-200';
		}
	}

	function getIcon(type: Toast['type']): string {
		switch (type) {
			case 'success':
				return '✓';
			case 'error':
				return '✕';
			case 'info':
				return 'ℹ';
		}
	}
</script>

{#if toasts.length > 0}
	<div
		class="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
		aria-live="polite"
		aria-label="Notifications"
	>
		{#each toasts as t (t.id)}
			<div
				class="pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg {getToastClasses(t.type)}"
				in:fly={{ y: 20, duration: 200 }}
				out:fade={{ duration: 150 }}
				role="alert"
			>
				<span class="flex h-5 w-5 items-center justify-center text-sm font-bold">
					{getIcon(t.type)}
				</span>
				<span class="flex-1 text-sm font-medium">{t.message}</span>
				<button
					onclick={() => toast.dismiss(t.id)}
					class="ml-2 opacity-60 transition hover:opacity-100"
					aria-label="Dismiss notification"
				>
					✕
				</button>
			</div>
		{/each}
	</div>
{/if}
