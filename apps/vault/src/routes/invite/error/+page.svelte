<script lang="ts">
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages.js';
	
	const errorMessage = $derived(page.url.searchParams.get('message') ?? m.common_error());
</script>

<svelte:head>
	<title>{m.invite_error_title()} | Polyphony Vault</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
	<div class="max-w-md text-center">
		<div class="mb-6 text-6xl">😕</div>
		<h1 class="mb-4 text-2xl font-bold text-gray-900">{m.invite_error_title()}</h1>
		<p class="mb-6 text-gray-600">
			{errorMessage}
		</p>
		<div class="space-x-4">
			<a
				href="/"
				class="inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
			>
				{m.invite_go_home()}
			</a>
		</div>
		<p class="mt-6 text-sm text-gray-500">
			{m.invite_error_help()}
		</p>
	</div>
</div>
