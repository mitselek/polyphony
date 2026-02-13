<script lang="ts">
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	// Role display names for badges
	const roleNames: Record<string, string> = {
		owner: 'Owner',
		admin: 'Admin',
		librarian: 'Librarian',
		conductor: 'Conductor',
		section_leader: 'Section Leader'
	};
</script>

<svelte:head>
	<title>{m["guides.title"]()} | Polyphony</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900">{m["guides.title"]()}</h1>
		<p class="mt-2 text-gray-600">{m["guides.subtitle"]()}</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.guides as guide}
			<a
				href="/guides/{guide.slug}"
				class="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
			>
				<div class="mb-3 text-3xl">{guide.icon}</div>
				<h2 class="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
					{guide.titles['et'] ?? guide.titles['en'] ?? guide.slug}
				</h2>
				<p class="mt-1 text-sm text-gray-500">
					{guide.descriptions['et'] ?? guide.descriptions['en'] ?? ''}
				</p>
				<div class="mt-3">
					{#if guide.roles.length === 0}
						<span class="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
							{m["guides.for_everyone"]()}
						</span>
					{:else}
						{#each guide.roles as role}
							<span class="mr-1 inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
								{roleNames[role] ?? role}
							</span>
						{/each}
					{/if}
				</div>
			</a>
		{/each}
	</div>
</div>
