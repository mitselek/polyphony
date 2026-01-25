<script lang="ts">
	import { enhance } from '$app/forms';

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
	<title>Copyright Takedown Request - Polyphony</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-4 py-8">
	<h1 class="mb-6 text-3xl font-bold">Copyright Takedown Request</h1>

	{#if submitted}
		<div class="rounded-lg bg-green-100 p-6 text-green-800">
			<h2 class="mb-2 text-xl font-semibold">Request Submitted</h2>
			<p>
				Thank you for your submission. We will review your request and respond within 48 hours.
			</p>
		</div>
	{:else}
		<p class="mb-6 text-gray-600">
			If you believe copyrighted material has been uploaded without authorization, 
			please submit a takedown request using the form below.
		</p>

		{#if error}
			<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
				{error}
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-6">
			<div>
				<label for="score_id" class="mb-1 block text-sm font-medium text-gray-700">
					Score ID (if known)
				</label>
				<input
					type="text"
					id="score_id"
					name="score_id"
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
					placeholder="Optional: paste the score URL or ID"
				/>
			</div>

			<div>
				<label for="claimant_email" class="mb-1 block text-sm font-medium text-gray-700">
					Your Email *
				</label>
				<input
					type="email"
					id="claimant_email"
					name="claimant_email"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
					placeholder="your.email@example.com"
				/>
			</div>

			<div>
				<label for="claim_type" class="mb-1 block text-sm font-medium text-gray-700">
					Claim Type *
				</label>
				<select
					id="claim_type"
					name="claim_type"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
				>
					<option value="copyright">Copyright Infringement</option>
					<option value="trademark">Trademark Violation</option>
					<option value="other">Other Legal Claim</option>
				</select>
			</div>

			<div>
				<label for="description" class="mb-1 block text-sm font-medium text-gray-700">
					Description *
				</label>
				<textarea
					id="description"
					name="description"
					required
					rows="5"
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
					placeholder="Please describe the copyrighted work and explain why you believe the uploaded content infringes your rights."
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
					I declare under penalty of perjury that I am the copyright owner or authorized to act on their behalf,
					and that I have a good faith belief that use of the copyrighted material is not authorized.
				</label>
			</div>

			<button
				type="submit"
				disabled={submitting}
				class="w-full rounded-md bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
			>
				{submitting ? 'Submitting...' : 'Submit Takedown Request'}
			</button>
		</form>
	{/if}
</main>
