<script lang="ts">
	import type { PageData } from './$types';
	import { ASSIGNABLE_ROLES, type Role } from '$lib/types';

	let { data }: { data: PageData } = $props();

	// Roster member mode: inviting an existing roster-only member
	// Use $derived for reactive access when data changes (e.g., navigation)
	let rosterMember = $derived(data.rosterMember);

	// Form state
	let roles = $state<Set<Role>>(new Set());
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

		if (!rosterMember) {
			error = 'Roster member is required. Go to Members → Add Roster Member first.';
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
					rosterMemberId: rosterMember.id,
					roles: Array.from(roles)
				})
			});

			if (!response.ok) {
				const respData = (await response.json()) as { message?: string };
				throw new Error(respData.message ?? 'Failed to send invite');
			}

			const result = (await response.json()) as { inviteLink: string };
			inviteLink = result.inviteLink;
			success = `Invitation created for ${rosterMember.name}! Copy the link below and share it with them.`;
			roles = new Set();
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

	<h1 class="mb-6 text-3xl font-bold">Invite Member</h1>

	{#if !rosterMember}
		<!-- No roster member selected - show instructions -->
		<div class="rounded-lg border border-amber-200 bg-amber-50 p-6">
			<h2 class="mb-2 text-lg font-semibold text-amber-800">No Member Selected</h2>
			<p class="mb-4 text-amber-700">
				To invite someone to your vault, first add them to the roster:
			</p>
			<ol class="mb-4 list-inside list-decimal space-y-2 text-amber-700">
				<li>Go to <a href="/members/add-roster" class="underline">Add Roster Member</a></li>
				<li>Fill in their name and assign voices/sections</li>
				<li>Click "Send Invitation" from their profile</li>
			</ol>
			<a
				href="/members/add-roster"
				class="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
			>
				Add Roster Member
			</a>
		</div>
	{:else}
		<!-- Inviting a roster member -->
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
			{:else}
				<!-- Member info card -->
				<div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
					<h2 class="text-lg font-semibold">{rosterMember.name}</h2>
					<div class="mt-2 flex flex-wrap gap-2">
						{#if rosterMember.voices.length > 0}
							{#each rosterMember.voices as voice}
								<span class="rounded bg-purple-100 px-2 py-1 text-xs text-purple-800">
									{voice.abbreviation}
								</span>
							{/each}
						{/if}
						{#if rosterMember.sections.length > 0}
							{#each rosterMember.sections as section}
								<span class="rounded bg-teal-100 px-2 py-1 text-xs text-teal-800">
									{section.abbreviation}
								</span>
							{/each}
						{/if}
					</div>
				</div>

				<form onsubmit={handleSubmit} class="space-y-4">
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
						</div>
						<p class="mt-2 text-sm text-gray-500">
							All members can view and download scores. Assign roles to grant additional permissions.
						</p>
					</fieldset>

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
						A unique invite link will be generated. Share it manually with {rosterMember.name}. The link expires in 48 hours.
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
