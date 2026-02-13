<!--
  OrgSwitcher: Dropdown for switching between organizations.
  Shown in the nav when a member belongs to 2+ orgs.
  Switching = navigating to another subdomain (SSO handles seamless re-auth).
-->
<script lang="ts">
	import type { OrgSummary } from '$lib/types';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		currentSubdomain: string;
		orgs: OrgSummary[];
	}

	let { currentSubdomain, orgs }: Props = $props();

	let open = $state(false);

	// Other orgs (exclude current)
	let otherOrgs = $derived(orgs.filter((o) => o.subdomain !== currentSubdomain));

	function buildOrgUrl(subdomain: string): string {
		if (typeof window !== 'undefined') {
			const { protocol, host } = window.location;
			// Replace current subdomain with target subdomain
			const newHost = host.replace(currentSubdomain, subdomain);
			return `${protocol}//${newHost}`;
		}
		return `https://${subdomain}.polyphony.uk`;
	}

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}
</script>

{#if otherOrgs.length > 0}
	<div class="relative">
		<button
			onclick={toggle}
			class="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
			aria-label="Switch organization"
			aria-expanded={open}
			aria-haspopup="true"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
			</svg>
		</button>

		{#if open}
			<!-- Backdrop to close on click outside -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="fixed inset-0 z-40" onclick={close} onkeydown={close}></div>

			<div class="absolute left-0 top-full z-50 mt-1 min-w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
				<div class="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">
					{m["nav.switch_to"]()}
				</div>
				{#each otherOrgs as org}
					<a
						href={buildOrgUrl(org.subdomain)}
						class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
						onclick={close}
					>
						{org.name}
					</a>
				{/each}
			</div>
		{/if}
	</div>
{/if}
