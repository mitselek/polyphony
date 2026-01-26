<script lang="ts">
	import '../app.css';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="border-b bg-white shadow-sm">
		<nav class="container mx-auto flex items-center justify-between px-4 py-3">
			<a href="/" class="text-xl font-bold text-gray-900">Polyphony Vault</a>

			<div class="flex items-center gap-4">
				<a href="/library" class="text-gray-600 hover:text-gray-900">Library</a>
				{#if data.user}
					{#if data.user.roles?.some((r) => ['librarian', 'owner'].includes(r))}
						<a href="/upload" class="text-gray-600 hover:text-gray-900">Upload</a>
					{/if}
					{#if data.user.roles?.some((r) => ['admin', 'owner'].includes(r))}
						<a href="/members" class="text-gray-600 hover:text-gray-900">Members</a>
						<a href="/settings" class="text-gray-600 hover:text-gray-900">Settings</a>
					{/if}
					<span class="text-sm text-gray-500">{data.user.name ?? data.user.email}</span>
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
		</nav>
	</header>

	<!-- Main Content -->
	<main>
		{@render children()}
	</main>
</div>
