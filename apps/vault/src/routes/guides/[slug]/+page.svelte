<script lang="ts">
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.guide.titles['et'] ?? data.guide.titles['en']} | Polyphony</title>
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
	<div class="mb-6">
		<a href="/guides" class="text-sm text-blue-600 hover:text-blue-800">
			{m["guides.back_to_guides"]()}
		</a>
	</div>

	<article class="prose prose-gray max-w-none rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
		{@html data.html}
	</article>

	<div class="mt-6">
		<a href="/guides" class="text-sm text-blue-600 hover:text-blue-800">
			{m["guides.back_to_guides"]()}
		</a>
	</div>
</div>

<style>
	/* Prose-like styling for rendered markdown */
	:global(.prose h1) {
		font-size: 1.875rem;
		font-weight: 700;
		color: #111827;
		margin-bottom: 0.5rem;
		line-height: 1.2;
	}
	:global(.prose h2) {
		font-size: 1.375rem;
		font-weight: 600;
		color: #1f2937;
		margin-top: 2rem;
		margin-bottom: 0.75rem;
		padding-bottom: 0.25rem;
		border-bottom: 1px solid #e5e7eb;
	}
	:global(.prose h3) {
		font-size: 1.125rem;
		font-weight: 600;
		color: #374151;
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
	}
	:global(.prose p) {
		color: #4b5563;
		line-height: 1.7;
		margin-bottom: 1rem;
	}
	:global(.prose em) {
		color: #6b7280;
	}
	:global(.prose strong) {
		color: #111827;
		font-weight: 600;
	}
	:global(.prose ul) {
		list-style-type: disc;
		padding-left: 1.5rem;
		margin-bottom: 1rem;
	}
	:global(.prose ol) {
		list-style-type: decimal;
		padding-left: 1.5rem;
		margin-bottom: 1rem;
	}
	:global(.prose li) {
		color: #4b5563;
		line-height: 1.7;
		margin-bottom: 0.25rem;
	}
	:global(.prose hr) {
		border-color: #e5e7eb;
		margin: 1.5rem 0;
	}
	:global(.prose blockquote) {
		border-left: 4px solid #3b82f6;
		padding-left: 1rem;
		color: #6b7280;
		font-style: italic;
		margin: 1rem 0;
	}
	:global(.prose table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1rem 0;
		font-size: 0.875rem;
	}
	:global(.prose th) {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		padding: 0.5rem 0.75rem;
		text-align: left;
		font-weight: 600;
		color: #374151;
	}
	:global(.prose td) {
		border: 1px solid #e5e7eb;
		padding: 0.5rem 0.75rem;
		color: #4b5563;
	}
	:global(.prose tr:hover) {
		background: #f9fafb;
	}
	:global(.prose code) {
		background: #f3f4f6;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.875em;
		color: #1f2937;
	}
</style>
