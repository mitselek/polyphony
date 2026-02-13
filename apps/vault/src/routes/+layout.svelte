<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';
	import Toast from '$lib/components/Toast.svelte';
	import OrgSwitcher from '$lib/components/OrgSwitcher.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { getVisibleNavItems, isNavItemActive } from '$lib/nav';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
	
	let mobileMenuOpen = $state(false);

	// Map labelKey → translated string (Paraglide fns can't be called dynamically)
	const labels: Record<string, () => string> = {
		nav_events: m.nav_events,
		nav_seasons: m.nav_seasons,
		nav_library: m.nav_library,
		nav_guides: m.nav_guides,
		nav_editions: m.nav_editions,
		nav_members: m.nav_members,
		nav_settings: m.nav_settings
	};

	let navItems = $derived(getVisibleNavItems(data.user?.roles ?? []));
	let mainItems = $derived(navItems.filter((i) => i.group === 'main'));
	let manageItems = $derived(navItems.filter((i) => i.group === 'manage'));
	let currentPath = $derived($page.url.pathname);
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
			<div class="hidden items-center gap-1 md:flex">
				{#if data.user}
					{#each mainItems as item}
						<a
							href={item.href}
							class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {isNavItemActive(item.href, currentPath) ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
						>{labels[item.labelKey]()}</a>
					{/each}
					{#if manageItems.length > 0}
						<span class="mx-1 h-5 w-px bg-gray-300"></span>
						{#each manageItems as item}
							<a
								href={item.href}
								class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {isNavItemActive(item.href, currentPath) ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
							>{labels[item.labelKey]()}</a>
						{/each}
					{/if}
					<span class="mx-1 h-5 w-px bg-gray-300"></span>
					<a
						href="/profile"
						class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {isNavItemActive('/profile', currentPath) ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}"
					>{data.user.name ?? data.user.email}</a>
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
				<div class="flex flex-col gap-1">
					{#if data.user}
						{#each mainItems as item}
							<a
								href={item.href}
								class="rounded-md px-3 py-2 text-sm font-medium {isNavItemActive(item.href, currentPath) ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
								onclick={() => mobileMenuOpen = false}
							>{labels[item.labelKey]()}</a>
						{/each}
						{#if manageItems.length > 0}
							<hr class="my-1 border-gray-200" />
							{#each manageItems as item}
								<a
									href={item.href}
									class="rounded-md px-3 py-2 text-sm font-medium {isNavItemActive(item.href, currentPath) ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
									onclick={() => mobileMenuOpen = false}
								>{labels[item.labelKey]()}</a>
							{/each}
						{/if}
						<hr class="my-1 border-gray-200" />
						<a
							href="/profile"
							class="rounded-md px-3 py-2 text-sm font-medium {isNavItemActive('/profile', currentPath) ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
							onclick={() => mobileMenuOpen = false}
						>{data.user.name ?? data.user.email}</a>
						{#if data.memberOrgs && data.memberOrgs.length > 1}
							<hr class="my-1 border-gray-200" />
							<span class="px-3 text-xs font-medium uppercase tracking-wider text-gray-400">{m.nav_switch_to()}</span>
							{#each data.memberOrgs.filter((o) => o.subdomain !== data.org?.subdomain) as org}
								<a
									href="https://{org.subdomain}.polyphony.uk/events/roster"
									class="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
									onclick={() => mobileMenuOpen = false}
								>
									{org.name}
								</a>
							{/each}
						{/if}
						<a
							href="/api/auth/logout"
							class="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
							onclick={() => mobileMenuOpen = false}
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
