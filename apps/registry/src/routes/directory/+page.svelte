<script lang="ts">
	// Vault directory - lists registered choirs (opt-in public listing)
</script>

<svelte:head>
	<title>Choir Directory | Polyphony</title>
	<meta name="description" content="Browse choirs and ensembles using Polyphony." />
</svelte:head>

<div class="min-h-screen bg-slate-50">
	<header class="bg-white border-b border-slate-100">
		<div class="mx-auto max-w-5xl px-6 py-4">
			<a href="/" class="flex items-center gap-2 text-slate-900 hover:text-indigo-600 transition">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
				</svg>
				<span class="font-semibold">Polyphony</span>
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-12">
		<h1 class="text-3xl font-bold text-slate-900 mb-2">Choir Directory</h1>
		<p class="text-slate-600 mb-8">
			Browse choirs and ensembles that have opted to be listed publicly.
		</p>

		<!-- Coming Soon -->
		<div class="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-100">
			<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<h2 class="text-xl font-semibold text-slate-900 mb-2">Coming Soon</h2>
			<p class="text-slate-600 max-w-md mx-auto">
				The public choir directory is under development. 
				Vault owners will be able to opt-in to have their choir listed here.
			</p>
		</div>
	</main>
</div>
