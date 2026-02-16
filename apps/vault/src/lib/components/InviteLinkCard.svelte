<script lang="ts">
	/**
	 * Reusable component for displaying and copying invite links.
	 * Used on:
	 * - /members/[id] page (member detail with pending invite)
	 * - /invite page (after creating or showing pending invite)
	 */
	import { toast } from '$lib/stores/toast';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		inviteLink: string;
		memberName: string;
		variant?: 'success' | 'info'; // success = just created, info = already pending
	}

	let { inviteLink, memberName, variant = 'info' }: Props = $props();

	const isSuccess = $derived(variant === 'success');
	const bgClass = $derived(isSuccess ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200');
	const textClass = $derived(isSuccess ? 'text-green-800' : 'text-blue-800');
	const subTextClass = $derived(isSuccess ? 'text-green-700' : 'text-blue-700');
	const borderClass = $derived(isSuccess ? 'border-green-300' : 'border-blue-300');
	const buttonClass = $derived(isSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700');

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(inviteLink);
			toast.success(m.invite_link_copied());
		} catch {
			toast.error(m.invite_link_copy_failed());
		}
	}
</script>

<div class="rounded-lg border p-4 {bgClass}">
	<p class="mb-3 font-medium {textClass}">
		{#if isSuccess}
			{m.invite_link_created({ name: memberName })}
		{:else}
			{m.invite_link_pending({ name: memberName })}
		{/if}
	</p>
	<p class="mb-3 text-sm {subTextClass}">{m.invite_link_share()}</p>
	<div class="flex gap-2">
		<input
			type="text"
			readonly
			value={inviteLink}
			class="flex-1 rounded border bg-white px-3 py-2 text-sm font-mono {borderClass}"
			onclick={(e) => e.currentTarget.select()}
		/>
		<button
			type="button"
			onclick={copyLink}
			class="rounded px-4 py-2 text-sm text-white {buttonClass}"
		>
			{m.invite_link_copy()}
		</button>
	</div>
</div>
