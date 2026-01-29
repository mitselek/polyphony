<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// PDF file URL (derived to capture data changes)
	let pdfUrl = $derived(`/api/editions/${data.edition.id}/file`);
</script>

<svelte:head>
	<title>{data.edition.name} | PDF Viewer | Polyphony Vault</title>
</svelte:head>

<div class="flex h-screen flex-col bg-gray-900">
	<!-- Header bar -->
	<header class="flex items-center justify-between bg-gray-800 px-4 py-3 text-white">
		<div class="flex items-center gap-4">
			<a
				href="/editions/{data.edition.id}"
				class="rounded px-3 py-1.5 text-sm hover:bg-gray-700"
				title="Back to edition"
			>
				← Back
			</a>
			<div class="border-l border-gray-600 pl-4">
				<h1 class="text-lg font-medium">{data.edition.name}</h1>
				{#if data.work}
					<p class="text-sm text-gray-400">{data.work.title}</p>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-2">
			<!-- Download button -->
			<a
				href={pdfUrl}
				download={data.edition.fileName}
				class="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
				</svg>
				Download
			</a>
		</div>
	</header>

	<!-- PDF embed - uses browser's native PDF viewer -->
	<div class="flex-1">
		<embed
			src={pdfUrl}
			type="application/pdf"
			class="h-full w-full"
			title="PDF viewer for {data.edition.name}"
		/>
	</div>
</div>
