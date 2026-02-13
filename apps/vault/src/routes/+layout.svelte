<script lang="ts">
	import '../app.css';
	import type { LayoutData } from './$types';
	import Toast from '$lib/components/Toast.svelte';
	import OrgSwitcher from '$lib/components/OrgSwitcher.svelte';
	import * as m from '$lib/paraglide/messages.js';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
	
	let mobileMenuOpen = $state(false);
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="border-b bg-white shadow-sm">
		<nav class="container mx-auto flex items-center justify-between px-4 py-3">
			<div class="flex items-center gap-2">
				<a href="/" class="text-xl font-bold text-gray-900">{data.org?.name ?? 'Polyphony'}</a>
				{#if data.user && data.memberOrgs?.length > 1}
					<OrgSwitcher currentSubdomain={data.org?.subdomain ?? ''} orgs={data.memberOrgs} />
				{/if}
			</div>

			<!-- Desktop Navigation -->
			<div class="hidden items-center gap-4 md:flex">
				{#if data.user}
					<a href="/works" class="text-gray-600 hover:text-gray-900">{m.nav_library()}</a>
					<a href="/events" class="text-gray-600 hover:text-gray-900">{m.nav_events()}</a>
					<a href="/events/roster" class="text-gray-600 hover:text-gray-900">{m.nav_roster()}</a>
					<a href="/seasons" class="text-gray-600 hover:text-gray-900">{m.nav_seasons()}</a>
					<a href="/guides" class="text-gray-600 hover:text-gray-900">{m.nav_guides()}</a>
					{#if data.user.roles?.some((r) => ['librarian', 'admin', 'owner'].includes(r))}
						<a href="/editions" class="text-gray-600 hover:text-gray-900">{m.nav_editions()}</a>
					{/if}
					{#if data.user.roles?.some((r) => ['admin', 'owner'].includes(r))}
						<a href="/members" class="text-gray-600 hover:text-gray-900">{m.nav_members()}</a>
						<a href="/settings" class="text-gray-600 hover:text-gray-900">{m.nav_settings()}</a>
					{/if}
					<a href="/profile" class="text-sm text-gray-500 hover:text-gray-700">{data.user.name ?? data.user.email}</a>
					<a
						href="/api/auth/logout"
						class="rounded-lg bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300"
					>
						{m.nav_logout()}
					</a>
				{:else}
					<a
						href="/login"
						class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
					>
						{m.nav_sign_in()}
					</a>
				{/if}
			</div>

			<!-- Mobile Hamburger Button -->
			<button
				class="flex flex-col gap-1.5 p-2 md:hidden"
				onclick={() => mobileMenuOpen = !mobileMenuOpen}
				aria-label="Toggle menu"
				aria-expanded={mobileMenuOpen}
			>
				<span class="block h-0.5 w-6 bg-gray-600 transition-transform {mobileMenuOpen ? 'translate-y-2 rotate-45' : ''}"></span>
				<span class="block h-0.5 w-6 bg-gray-600 transition-opacity {mobileMenuOpen ? 'opacity-0' : ''}"></span>
				<span class="block h-0.5 w-6 bg-gray-600 transition-transform {mobileMenuOpen ? '-translate-y-2 -rotate-45' : ''}"></span>
			</button>
		</nav>

		<!-- Mobile Menu -->
		{#if mobileMenuOpen}
			<div class="border-t bg-white px-4 py-3 md:hidden">
				<div class="flex flex-col gap-3">
					{#if data.user}
						<a href="/works" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>{m.nav_library()}</a>
						<a href="/events" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>{m.nav_events()}</a>
						<a href="/events/roster" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>{m.nav_roster()}</a>
						<a href="/seasons" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>{m.nav_seasons()}</a>
						<a href="/guides" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>{m.nav_guides()}</a>
						{#if data.user.roles?.some((r) => ['librarian', 'admin', 'owner'].includes(r))}
							<a href="/editions" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>{m.nav_editions()}</a>
						{/if}
						{#if data.user.roles?.some((r) => ['admin', 'owner'].includes(r))}
							<a href="/members" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>{m.nav_members()}</a>
							<a href="/settings" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>{m.nav_settings()}</a>
						{/if}
						<hr class="border-gray-200" />
						<a href="/profile" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>{data.user.name ?? data.user.email}</a>
						{#if data.memberOrgs && data.memberOrgs.length > 1}
							<hr class="border-gray-200" />
							<span class="text-xs font-medium uppercase tracking-wider text-gray-400">{m.nav_switch_to()}</span>
							{#each data.memberOrgs.filter((o) => o.subdomain !== data.org?.subdomain) as org}
								<a
									href="https://{org.subdomain}.polyphony.uk"
									class="text-gray-600 hover:text-gray-900"
									onclick={() => mobileMenuOpen = false}
								>
									{org.name}
								</a>
							{/each}
						{/if}
						<a
							href="/api/auth/logout"
							class="text-gray-600 hover:text-gray-900"
						>
							{m.nav_logout()}
						</a>
					{:else}
						<a
							href="/login"
							class="rounded-lg bg-blue-600 px-4 py-2 text-center text-white hover:bg-blue-700"
						>
							{m.nav_sign_in()}
						</a>
					{/if}
				</div>
			</div>
		{/if}
	</header>

	<!-- Main Content -->
	<main>
		{@render children()}
	</main>

	<!-- Toast Notifications -->
	<Toast />
</div>
