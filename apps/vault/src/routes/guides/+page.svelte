<script lang="ts">
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';

	let { data }: { data: PageData } = $props();

	// Translated role display names
	const roleMsgKeys: Record<string, () => string> = {
		owner: () => m.roles_owner(),
		admin: () => m.roles_admin(),
		librarian: () => m.roles_librarian(),
		conductor: () => m.roles_conductor(),
		section_leader: () => m.roles_section_leader()
	};

	function localizedText(texts: Record<string, string>): string {
		const lang = getLocale();
		return texts[lang] ?? texts['en'] ?? Object.values(texts)[0] ?? '';
	}
</script>

<svelte:head>
	<title>{m.guides_title()} | Polyphony</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900">{m.guides_title()}</h1>
		<p class="mt-2 text-gray-600">{m.guides_subtitle()}</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.guides as guide}
			<a
				href="/guides/{guide.slug}"
				class="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
			>
				<div class="mb-3 text-3xl">{guide.icon}</div>
				<h2 class="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
					{localizedText(guide.titles)}
				</h2>
				<p class="mt-1 text-sm text-gray-500">
					{localizedText(guide.descriptions)}
				</p>
				<div class="mt-3">
					{#if guide.roles.length === 0}
						<span class="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
							{m.guides_for_everyone()}
						</span>
					{:else}
						{#each guide.roles as role}
							<span class="mr-1 inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
							{roleMsgKeys[role]?.() ?? role}
							</span>
						{/each}
					{/if}
				</div>
			</a>
		{/each}
	</div>
</div>
