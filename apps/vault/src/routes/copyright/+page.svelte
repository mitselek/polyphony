<script lang="ts">
	import { enhance } from '$app/forms';
	import * as m from '$lib/paraglide/messages.js';

	let submitting = $state(false);
	let submitted = $state(false);
	let error = $state('');

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		error = '';

		const form = event.target as HTMLFormElement;
		const formData = new FormData(form);
		
		const data = {
			score_id: (formData.get('score_id') as string) || 'unknown',
			claimant_email: formData.get('claimant_email') as string,
			claim_type: formData.get('claim_type') as string || 'copyright',
			description: formData.get('description') as string,
			good_faith_attestation: formData.get('attestation') === 'on'
		};

		try {
			const response = await fetch('/copyright', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			if (response.ok) {
				submitted = true;
			} else {
				const result = (await response.json()) as { error?: string };
				error = result.error || 'Failed to submit takedown request';
			}
		} catch (e) {
			error = 'Network error. Please try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{m["copyright.title"]()} - Polyphony</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-4 py-8">
	<h1 class="mb-6 text-3xl font-bold">{m["copyright.title"]()}</h1>

	{#if submitted}
		<div class="rounded-lg bg-green-100 p-6 text-green-800">
			<h2 class="mb-2 text-xl font-semibold">{m["copyright.submitted_title"]()}</h2>
			<p>
				{m["copyright.submitted_message"]()}
			</p>
		</div>
	{:else}
		<p class="mb-6 text-gray-600">
			{m["copyright.intro"]()}
		</p>

		{#if error}
			<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
				{error}
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-6">
			<div>
				<label for="score_id" class="mb-1 block text-sm font-medium text-gray-700">
					{m["copyright.score_id_label"]()}
				</label>
				<input
					type="text"
					id="score_id"
					name="score_id"
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
					placeholder={m["copyright.score_id_placeholder"]()}
				/>
			</div>

			<div>
				<label for="claimant_email" class="mb-1 block text-sm font-medium text-gray-700">
					{m["copyright.email_label"]()} *
				</label>
				<input
					type="email"
					id="claimant_email"
					name="claimant_email"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
					placeholder={m["copyright.email_placeholder"]()}
				/>
			</div>

			<div>
				<label for="claim_type" class="mb-1 block text-sm font-medium text-gray-700">
					{m["copyright.claim_type_label"]()} *
				</label>
				<select
					id="claim_type"
					name="claim_type"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
				>
					<option value="copyright">{m["copyright.claim_type_copyright"]()}</option>
					<option value="trademark">{m["copyright.claim_type_trademark"]()}</option>
					<option value="other">{m["copyright.claim_type_other"]()}</option>
				</select>
			</div>

			<div>
				<label for="description" class="mb-1 block text-sm font-medium text-gray-700">
					{m["copyright.description_label"]()} *
				</label>
				<textarea
					id="description"
					name="description"
					required
					rows="5"
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
					placeholder={m["copyright.description_placeholder"]()}
				></textarea>
			</div>

			<div class="flex items-start gap-2">
				<input
					type="checkbox"
					id="attestation"
					name="attestation"
					required
					class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
				/>
				<label for="attestation" class="text-sm text-gray-700">
					{m["copyright.attestation"]()}
				</label>
			</div>

			<button
				type="submit"
				disabled={submitting}
				class="w-full rounded-md bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
			>
				{submitting ? m["copyright.submitting"]() : m["copyright.submit"]()}
			</button>
		</form>
	{/if}
</main>
