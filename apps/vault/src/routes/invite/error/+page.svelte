<script lang="ts">
	import { page } from '$app/state';
	
	const errorMessage = $derived(page.url.searchParams.get('message') ?? 'An error occurred');
</script>

<svelte:head>
	<title>Invitation Error | Polyphony Vault</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
	<div class="max-w-md text-center">
		<div class="mb-6 text-6xl">😕</div>
		<h1 class="mb-4 text-2xl font-bold text-gray-900">Invitation Problem</h1>
		<p class="mb-6 text-gray-600">
			{errorMessage}
		</p>
		<div class="space-x-4">
			<a
				href="/"
				class="inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
			>
				Go Home
			</a>
		</div>
		<p class="mt-6 text-sm text-gray-500">
			If you believe this is an error, please contact your choir administrator.
		</p>
	</div>
</div>
