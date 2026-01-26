<script lang="ts">
	import type { PageData } from './$types';
	import { ASSIGNABLE_ROLES, type Role } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let name = $state('');
	let roles = $state<Set<Role>>(new Set());
	let voicePart = $state<string | null>(null);
	let isSubmitting = $state(false);
	let error = $state('');
	let success = $state('');
	let inviteLink = $state('');

	function toggleRole(role: Role) {
		const newRoles = new Set(roles);
		if (newRoles.has(role)) {
			newRoles.delete(role);
		} else {
			newRoles.add(role);
		}
		roles = newRoles;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!name) {
			error = 'Name is required';
			return;
		}

		isSubmitting = true;
		error = '';
		success = '';
		inviteLink = '';

		try {
			const response = await fetch('/api/members/invite', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name,
					roles: Array.from(roles),
					voicePart: voicePart || null
				})
			});

			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to send invite');
			}

			const result = (await response.json()) as { inviteLink: string };
			inviteLink = result.inviteLink;
			success = `Invitation created for ${name}! Copy the link below and share it with them.`;
			name = '';
			roles = new Set();
			voicePart = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to send invite';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Invite Member | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-xl px-4 py-8">
	<div class="mb-8">
		<a href="/members" class="text-blue-600 hover:underline">← Back to Members</a>
	</div>

	<h1 class="mb-6 text-3xl font-bold">Invite New Member</h1>

	<div class="rounded-lg bg-white p-6 shadow-md">
		{#if error}
			<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
				{error}
			</div>
		{/if}

		{#if success}
			<div class="mb-4 rounded-lg bg-green-100 p-4 text-green-700">
				<p class="font-semibold">{success}</p>
				{#if inviteLink}
					<div class="mt-3">
						<p class="mb-2 text-sm">Share this link with the invitee:</p>
						<div class="flex gap-2">
							<input
								type="text"
								readonly
								value={inviteLink}
								class="flex-1 rounded border border-green-300 bg-white px-3 py-2 text-sm font-mono"
								onclick={(e) => e.currentTarget.select()}
							/>
							<button
								type="button"
								onclick={() => navigator.clipboard.writeText(inviteLink)}
								class="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
							>
								Copy
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				<label for="name" class="mb-1 block text-sm font-medium text-gray-700">
					Invitee Name *
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
			</div>

			<fieldset>
				<legend class="mb-2 block text-sm font-medium text-gray-700">
				Roles (optional)
				</legend>
				<div class="space-y-2">
				{#each ASSIGNABLE_ROLES as role}
					{#if role !== 'owner' || data.isOwner}
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								checked={roles.has(role)}
								onchange={() => toggleRole(role)}
								disabled={isSubmitting}
								class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
							/>
							<span class="text-sm">
								<span class="font-medium capitalize">{role.replace('_', ' ')}</span>
								{#if role === 'owner'}
									- Full system access including owner management
								{:else if role === 'admin'}
									- Member and role management
								{:else if role === 'librarian'}
									- Score management (upload, delete)
								{:else if role === 'conductor'}
									- Event and attendance management
								{:else if role === 'section_leader'}
									- Attendance recording
								{/if}
							</span>
						</label>
					{/if}
				{/each}

			<div>
				<label for="voicePart" class="mb-1 block text-sm font-medium text-gray-700">
					Voice Part (optional)
				</label>
				<select
					id="voicePart"
					bind:value={voicePart}
					disabled={isSubmitting}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
				>
					<option value={null}>None</option>
					<option value="S">S (Soprano)</option>
					<option value="A">A (Alto)</option>
					<option value="T">T (Tenor)</option>
					<option value="B">B (Bass)</option>
					<option value="SA">SA (Soprano/Alto)</option>
					<option value="AT">AT (Alto/Tenor)</option>
					<option value="TB">TB (Tenor/Bass)</option>
					<option value="SAT">SAT (Soprano/Alto/Tenor)</option>
					<option value="ATB">ATB (Alto/Tenor/Bass)</option>
					<option value="SATB">SATB (All parts)</option>
				</select>
			</div>

			<button
				type="submit"
				disabled={isSubmitting}
				class="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:bg-blue-300"
			>
				{#if isSubmitting}
					Sending...
				{:else}
					Send Invitation
				{/if}
			</button>
		</form>

		<div class="mt-6 border-t pt-4 text-sm text-gray-500">
			<p>
				A unique invite link will be generated. Share it manually with the invitee. The link expires in 48 hours.
			</p>
		</div>
	</div>
</div>
