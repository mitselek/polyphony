<script lang="ts">
	import { onMount } from 'svelte';
	import type { LayoutData } from './$types';

	let { data }: { data: LayoutData } = $props();

	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});

	// Check if user can upload (librarian or owner)
	const canUpload = $derived(
		data.user?.roles?.some((r) => ['librarian', 'owner'].includes(r)) ?? false
	);
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
	<div class="max-w-2xl w-full text-center">
		<h1 class="text-4xl font-bold text-gray-900 mb-4">Polyphony Vault</h1>
		<p class="text-xl text-gray-600 mb-8">
			Sheet Music Library Management for Choirs
		</p>

		{#if mounted}
			<div class="bg-white rounded-lg shadow-md p-8">
				<div class="flex gap-4 justify-center mb-8">
					<a
						href="/library"
						class="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
					>
						Browse Library
					</a>
					{#if canUpload}
						<a
							href="/upload"
							class="rounded-lg bg-gray-100 px-6 py-3 text-gray-700 font-medium hover:bg-gray-200 transition"
						>
							Upload Score
						</a>
					{/if}
				</div>

				<h2 class="text-2xl font-semibold text-gray-800 mb-4">Phase 1: MVP</h2>
				<p class="text-gray-600 mb-6">
					A standalone vault application for managing choir sheet music libraries.
				</p>

				<div class="grid gap-4 text-left">
					<div class="border-l-4 border-blue-500 pl-4">
						<h3 class="font-semibold text-gray-800">Upload Scores</h3>
						<p class="text-sm text-gray-600">Manage your choir's PDF sheet music library</p>
					</div>
					<div class="border-l-4 border-green-500 pl-4">
						<h3 class="font-semibold text-gray-800">Invite Members</h3>
						<p class="text-sm text-gray-600">Share scores with choir members via magic links</p>
					</div>
					<div class="border-l-4 border-purple-500 pl-4">
						<h3 class="font-semibold text-gray-800">Permission Control</h3>
						<p class="text-sm text-gray-600">Control who can view and download each score</p>
					</div>
					<div class="border-l-4 border-red-500 pl-4">
						<h3 class="font-semibold text-gray-800">Copyright Protection</h3>
						<p class="text-sm text-gray-600">Handle takedown requests transparently</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
