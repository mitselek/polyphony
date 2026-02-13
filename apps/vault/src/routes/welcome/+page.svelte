<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.welcome_title()} | Polyphony Vault</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
	<div class="max-w-md text-center">
		<div class="mb-6 text-6xl">🎉</div>
		<h1 class="mb-4 text-2xl font-bold text-gray-900">{m.welcome_title()}</h1>
		<p class="mb-6 text-gray-600">
			{m.welcome_message()}
		</p>
		<a
			href="/works"
			class="inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
		>
			{m.welcome_browse_library()}
		</a>
	</div>
</div>
