<script lang="ts">
	import type { PageData } from './$types';
	import { ASSIGNABLE_ROLES, type Role } from '$lib/types';
	import { toast } from '$lib/stores/toast';
	import { VoiceBadge, SectionBadge } from '$lib/components/badges';
	import InviteLinkCard from '$lib/components/InviteLinkCard.svelte';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	// Roster member mode: inviting an existing roster-only member
	// Use $derived for reactive access when data changes (e.g., navigation)
	let rosterMember = $derived(data.rosterMember);

	// Form state
	let roles = $state<Set<Role>>(new Set());
	let isSubmitting = $state(false);
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
			toast.error('Roster member is required. Go to Members → Add Roster Member first.');
			return;
		}

		isSubmitting = true;
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
			toast.error(err instanceof Error ? err.message : 'Failed to send invite');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>{m["invite.title"]()} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-xl px-4 py-8">
	<div class="mb-8">
		<a href="/members" class="text-blue-600 hover:underline">{m["invite.back_to_members"]()}</a>
	</div>

	<h1 class="mb-6 text-3xl font-bold">{m["invite.title"]()}</h1>

	{#if !rosterMember}
		<!-- No roster member selected - show instructions -->
		<div class="rounded-lg border border-amber-200 bg-amber-50 p-6">
			<h2 class="mb-2 text-lg font-semibold text-amber-800">{m["invite.no_member_title"]()}</h2>
			<p class="mb-4 text-amber-700">
				{m["invite.no_member_instructions"]()}
			</p>
			<ol class="mb-4 list-inside list-decimal space-y-2 text-amber-700">
				<li><a href="/members/add-roster" class="underline">{m["invite.step_1"]()}</a></li>
				<li>{m["invite.step_2"]()}</li>
				<li>{m["invite.step_3"]()}</li>
			</ol>
			<a
				href="/members/add-roster"
				class="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
			>
				{m["invite.add_roster_member"]()}
			</a>
		</div>
	{:else if data.pendingInviteLink}
		<!-- Member already has a pending invite - show copy link -->
		<div class="rounded-lg bg-white p-6 shadow-md">
			<div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
				<h2 class="text-lg font-semibold">{rosterMember.name}</h2>
				<div class="mt-2 flex flex-wrap gap-2">
					{#if rosterMember.voices.length > 0}
						{#each rosterMember.voices as voice, index}
							<VoiceBadge {voice} isPrimary={index === 0} />
						{/each}
					{/if}
					{#if rosterMember.sections.length > 0}
						{#each rosterMember.sections as section, index}
							<SectionBadge {section} isPrimary={index === 0} />
						{/each}
					{/if}
				</div>
			</div>

			<InviteLinkCard 
				inviteLink={data.pendingInviteLink}
				memberName={rosterMember.name}
				variant="info"
			/>

			<div class="mt-4 text-center">
				<a href="/members" class="text-blue-600 hover:underline">← Back to Members</a>
			</div>
		</div>
	{:else}
		<!-- Inviting a roster member -->
		<div class="rounded-lg bg-white p-6 shadow-md">
			{#if success}
				<InviteLinkCard 
					{inviteLink}
					memberName={rosterMember.name}
					variant="success"
				/>
			{:else}
				<div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
					<h2 class="text-lg font-semibold">{rosterMember.name}</h2>
					<div class="mt-2 flex flex-wrap gap-2">
						{#if rosterMember.voices.length > 0}
							{#each rosterMember.voices as voice, index}
								<VoiceBadge {voice} isPrimary={index === 0} />
							{/each}
						{/if}
						{#if rosterMember.sections.length > 0}
							{#each rosterMember.sections as section, index}
								<SectionBadge {section} isPrimary={index === 0} />
							{/each}
						{/if}
					</div>
				</div>

				<form onsubmit={handleSubmit} class="space-y-4">
					<fieldset>
						<legend class="mb-2 block text-sm font-medium text-gray-700">
							{m["invite.roles_legend"]()}
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
												- {m["invite.role_owner_desc"]()}
											{:else if role === 'admin'}
												- {m["invite.role_admin_desc"]()}
											{:else if role === 'librarian'}
												- {m["invite.role_librarian_desc"]()}
											{:else if role === 'conductor'}
												- {m["invite.role_conductor_desc"]()}
											{:else if role === 'section_leader'}
												- {m["invite.role_section_leader_desc"]()}
											{/if}
										</span>
									</label>
								{/if}
							{/each}
						</div>
						<p class="mt-2 text-sm text-gray-500">
							{m["invite.roles_help"]()}
						</p>
					</fieldset>

					<button
						type="submit"
						disabled={isSubmitting}
						class="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:bg-blue-300"
					>
						{#if isSubmitting}
							{m["invite.sending"]()}
						{:else}
							{m["invite.send_invitation"]()}
						{/if}
					</button>
				</form>

				<div class="mt-6 border-t pt-4 text-sm text-gray-500">
					<p>
						{m["invite.link_info"]({ name: rosterMember.name })}
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
