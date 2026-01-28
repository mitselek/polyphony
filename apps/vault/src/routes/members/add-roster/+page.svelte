<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

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
	<title>Add Roster Member | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-xl px-4 py-8">
	<div class="mb-8">
		<a href="/members" class="text-blue-600 hover:underline">← Back to Members</a>
	</div>

	<h1 class="mb-2 text-3xl font-bold">Add Roster Member</h1>
	<p class="mb-6 text-gray-600">
		Add a member to the choir roster without granting system access. They can register later via invitation.
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
					Full Name *
				</label>
				<input
					type="text"
					id="name"
					bind:value={name}
					required
					disabled={isSubmitting}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
					placeholder="John Doe"
				/>
				<p class="mt-1 text-xs text-gray-500">
					Must be unique. Used to identify the member in the roster.
				</p>
			</div>

			<div>
				<label for="emailContact" class="mb-1 block text-sm font-medium text-gray-700">
					Contact Email (optional)
				</label>
				<input
					type="email"
					id="emailContact"
					bind:value={emailContact}
					disabled={isSubmitting}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
					placeholder="john@example.com"
				/>
				<p class="mt-1 text-xs text-gray-500">
					For notifications. Not used for authentication (roster members cannot log in until invited).
				</p>
			</div>

			<fieldset>
				<legend class="mb-2 block text-sm font-medium text-gray-700">
					Vocal Range (optional)
					<span class="ml-1 text-xs font-normal text-gray-500" title="What the member CAN sing - their vocal capabilities">ⓘ</span>
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
					Select all ranges this member can comfortably sing. First selected becomes primary.
				</p>
			</fieldset>

			<fieldset>
				<legend class="mb-2 block text-sm font-medium text-gray-700">
					Assigned Section (optional)
					<span class="ml-1 text-xs font-normal text-gray-500" title="Where the member DOES sing currently - their performance assignment">ⓘ</span>
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
					Assign to one or more sections for performances. First selected becomes primary.
				</p>
			</fieldset>

			<button
				type="submit"
				disabled={isSubmitting}
				class="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:bg-blue-300"
			>
				{#if isSubmitting}
					Adding...
				{:else}
					Add Roster Member
				{/if}
			</button>
		</form>

		<div class="mt-6 border-t pt-4 text-sm text-gray-500">
			<p class="mb-2">
				<strong>Roster members</strong> are listed in the choir roster but <strong>cannot log in</strong> until invited.
			</p>
			<p>
				After adding a member, you can send them an invitation from the members list to grant system access.
			</p>
		</div>
	</div>
</div>
