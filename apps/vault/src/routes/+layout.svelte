<script lang="ts">
	import '../app.css';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
	
	let mobileMenuOpen = $state(false);
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="border-b bg-white shadow-sm">
		<nav class="container mx-auto flex items-center justify-between px-4 py-3">
			<a href="/" class="text-xl font-bold text-gray-900">Polyphony Vault</a>

			<!-- Desktop Navigation -->
			<div class="hidden items-center gap-4 md:flex">
				<a href="/library" class="text-gray-400 line-through hover:text-gray-600" title="Deprecated - use Works/Editions">Library</a>
				{#if data.user}
					<a href="/events" class="text-gray-600 hover:text-gray-900">Events</a>
					<a href="/events/roster" class="text-gray-600 hover:text-gray-900">Roster</a>
					{#if data.user.roles?.some((r) => ['librarian', 'admin', 'owner'].includes(r))}
						<a href="/works" class="text-gray-600 hover:text-gray-900">Works</a>					<a href="/editions" class="text-gray-600 hover:text-gray-900">Editions</a>						<a href="/upload" class="text-gray-400 line-through hover:text-gray-600" title="Deprecated - use Works/Editions">Upload</a>
					{/if}
					{#if data.user.roles?.some((r) => ['admin', 'owner'].includes(r))}
						<a href="/members" class="text-gray-600 hover:text-gray-900">Members</a>
						<a href="/settings" class="text-gray-600 hover:text-gray-900">Settings</a>
					{/if}
					<a href="/profile" class="text-sm text-gray-500 hover:text-gray-700">{data.user.name ?? data.user.email}</a>
					<a
						href="/api/auth/logout"
						class="rounded-lg bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300"
					>
						Logout
					</a>
				{:else}
					<a
						href="/api/auth/login"
						class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
					>
						Sign In
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
					<a href="/library" class="text-gray-400 line-through hover:text-gray-600" title="Deprecated - use Works/Editions" onclick={() => mobileMenuOpen = false}>Library</a>
					{#if data.user}
						<a href="/events" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>Events</a>
						<a href="/events/roster" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>Roster</a>
						{#if data.user.roles?.some((r) => ['librarian', 'admin', 'owner'].includes(r))}
							<a href="/works" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>Works</a>						<a href="/editions" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>Editions</a>							<a href="/upload" class="text-gray-400 line-through hover:text-gray-600" title="Deprecated - use Works/Editions" onclick={() => mobileMenuOpen = false}>Upload</a>
						{/if}
						{#if data.user.roles?.some((r) => ['admin', 'owner'].includes(r))}
							<a href="/members" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>Members</a>
							<a href="/settings" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>Settings</a>
						{/if}
						<hr class="border-gray-200" />
						<a href="/profile" class="text-gray-600 hover:text-gray-900" onclick={() => mobileMenuOpen = false}>{data.user.name ?? data.user.email}</a>
						<a
							href="/api/auth/logout"
							class="text-gray-600 hover:text-gray-900"
						>
							Logout
						</a>
					{:else}
						<a
							href="/api/auth/login"
							class="rounded-lg bg-blue-600 px-4 py-2 text-center text-white hover:bg-blue-700"
						>
							Sign In
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
</div>
