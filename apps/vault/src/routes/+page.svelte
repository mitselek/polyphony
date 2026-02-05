<script lang="ts">
	import { onMount } from 'svelte';
	import type { LayoutData } from './$types';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: LayoutData } = $props();

	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
	<div class="max-w-2xl w-full text-center">
		<h1 class="text-4xl font-bold text-gray-900 mb-4">{m["landing.title"]()}</h1>
		<p class="text-xl text-gray-600 mb-8">
			{m["landing.subtitle"]()}
		</p>

		{#if mounted}
			<div class="bg-white rounded-lg shadow-md p-8">
				<div class="flex gap-4 justify-center mb-8">
					<a
						href="/works"
						class="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
					>
						{m["landing.browse_library"]()}
					</a>
				</div>

				<h2 class="text-2xl font-semibold text-gray-800 mb-4">{m["landing.phase_title"]()}</h2>
				<p class="text-gray-600 mb-6">
					{m["landing.phase_description"]()}
				</p>

				<div class="grid gap-4 text-left">
					<div class="border-l-4 border-blue-500 pl-4">
						<h3 class="font-semibold text-gray-800">{m["landing.feature_upload_title"]()}</h3>
						<p class="text-sm text-gray-600">{m["landing.feature_upload_desc"]()}</p>
					</div>
					<div class="border-l-4 border-green-500 pl-4">
						<h3 class="font-semibold text-gray-800">{m["landing.feature_invite_title"]()}</h3>
						<p class="text-sm text-gray-600">{m["landing.feature_invite_desc"]()}</p>
					</div>
					<div class="border-l-4 border-purple-500 pl-4">
						<h3 class="font-semibold text-gray-800">{m["landing.feature_permissions_title"]()}</h3>
						<p class="text-sm text-gray-600">{m["landing.feature_permissions_desc"]()}</p>
					</div>
					<div class="border-l-4 border-red-500 pl-4">
						<h3 class="font-semibold text-gray-800">{m["landing.feature_copyright_title"]()}</h3>
						<p class="text-sm text-gray-600">{m["landing.feature_copyright_desc"]()}</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
