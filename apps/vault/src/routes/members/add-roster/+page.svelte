<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	let name = $state('');
	let emailContact = $state('');
	let voiceIds = $state<Set<string>>(new Set());
	let sectionIds = $state<Set<string>>(new Set());
	let isSubmitting = $state(false);
	let error = $state('');

	function toggleVoice(voiceId: string) {
		const newVoices = new Set(voiceIds);
		if (newVoices.has(voiceId)) {
			newVoices.delete(voiceId);
		} else {
			newVoices.add(voiceId);
		}
		voiceIds = newVoices;
	}

	function toggleSection(sectionId: string) {
		const newSections = new Set(sectionIds);
		if (newSections.has(sectionId)) {
			newSections.delete(sectionId);
		} else {
			newSections.add(sectionId);
		}
		sectionIds = newSections;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!name.trim()) {
			error = 'Name is required';
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			const response = await fetch('/api/members/roster', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: name.trim(),
					emailContact: emailContact.trim() || undefined,
					voiceIds: Array.from(voiceIds),
					sectionIds: Array.from(sectionIds)
				})
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to add roster member');
			}

			// Success - redirect to members list with success message
			goto(`/members?added=${encodeURIComponent(name.trim())}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add roster member';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>{m.add_roster_title()} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-xl px-4 py-8">
	<div class="mb-8">
		<a href="/members" class="text-blue-600 hover:underline">{m.member_back_link()}</a>
	</div>

	<h1 class="mb-2 text-3xl font-bold">{m.add_roster_title()}</h1>
	<p class="mb-6 text-gray-600">
		{m.add_roster_description()}
	</p>

	<div class="rounded-lg bg-white p-6 shadow-md">
		{#if error}
			<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
				{error}
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				<label for="name" class="mb-1 block text-sm font-medium text-gray-700">
					{m.add_roster_name_label()}
				</label>
				<input
					type="text"
					id="name"
					bind:value={name}
					required
					disabled={isSubmitting}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
					placeholder={m.add_roster_name_placeholder()}
				/>
				<p class="mt-1 text-xs text-gray-500">
					{m.add_roster_name_help()}
				</p>
			</div>

			<div>
				<label for="emailContact" class="mb-1 block text-sm font-medium text-gray-700">
					{m.add_roster_email_label()}
				</label>
				<input
					type="email"
					id="emailContact"
					bind:value={emailContact}
					disabled={isSubmitting}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
					placeholder={m.add_roster_email_placeholder()}
				/>
				<p class="mt-1 text-xs text-gray-500">
					{m.add_roster_email_help()}
				</p>
			</div>

			<fieldset>
				<legend class="mb-2 block text-sm font-medium text-gray-700">
					{m.add_roster_voices_label()}
					<span class="ml-1 text-xs font-normal text-gray-500" title={m.add_roster_voices_tooltip()}>ⓘ</span>
				</legend>
				<div class="space-y-2">
					{#each data.availableVoices as voice}
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								checked={voiceIds.has(voice.id)}
								onchange={() => toggleVoice(voice.id)}
								disabled={isSubmitting}
								class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
							/>
							<span class="text-sm">
								<span class="font-medium">{voice.abbreviation}</span>
								<span class="text-gray-600">({voice.name})</span>
							</span>
						</label>
					{/each}
				</div>
				<p class="mt-2 text-sm text-gray-500">
					{m.add_roster_voices_help()}
				</p>
			</fieldset>

			<fieldset>
				<legend class="mb-2 block text-sm font-medium text-gray-700">
					{m.add_roster_sections_label()}
					<span class="ml-1 text-xs font-normal text-gray-500" title={m.add_roster_sections_tooltip()}>ⓘ</span>
				</legend>
				<div class="space-y-2">
					{#each data.availableSections as section}
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								checked={sectionIds.has(section.id)}
								onchange={() => toggleSection(section.id)}
								disabled={isSubmitting}
								class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
							/>
							<span class="text-sm">
								<span class="font-medium">{section.abbreviation}</span>
								<span class="text-gray-600">({section.name})</span>
							</span>
						</label>
					{/each}
				</div>
				<p class="mt-2 text-sm text-gray-500">
					{m.add_roster_sections_help()}
				</p>
			</fieldset>

			<button
				type="submit"
				disabled={isSubmitting}
				class="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:bg-blue-300"
			>
				{#if isSubmitting}
					{m.add_roster_submitting()}
				{:else}
					{m.add_roster_submit_btn()}
				{/if}
			</button>
		</form>

		<div class="mt-6 border-t pt-4 text-sm text-gray-500">
			<p>
				{m.add_roster_help_text()}
			</p>
		</div>
	</div>
</div>
