<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import { ASSIGNABLE_ROLES } from '$lib/types';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	// Make a reactive copy of members for local updates
	// Using untrack to intentionally capture only initial value
	// The $effect below will handle subsequent updates
	let members = $state(untrack(() => data.members));
	let invites = $state(untrack(() => data.invites));
	let searchQuery = $state('');
	let updatingMember = $state<string | null>(null);
	let removingMember = $state<string | null>(null);
	let revokingInvite = $state<string | null>(null);
	let renewingInvite = $state<string | null>(null);
	let error = $state('');
	let successMessage = $state('');
	let showingVoiceDropdown = $state<string | null>(null);
	let showingSectionDropdown = $state<string | null>(null);

	// Watch for data changes (e.g., on navigation) and update local state
	$effect(() => {
		members = data.members;
		invites = data.invites;
	});

	// Check for success message from query param
	$effect(() => {
		const addedName = $page.url.searchParams.get('added');
		if (addedName) {
			successMessage = `Successfully added roster member "${addedName}"`;
			setTimeout(() => (successMessage = ''), 5000);
			// Remove query param from URL without reload
			const url = new URL($page.url);
			url.searchParams.delete('added');
			history.replaceState({}, '', url);
		}
	});

	// Helper to check if invite is expired
	function isInviteExpired(expiresAt: string): boolean {
		return new Date(expiresAt) < new Date();
	}

	let filteredMembers = $derived(
		members.filter(
			(m: typeof members[0]) =>
				(m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
				m.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	async function revokeInvite(inviteId: string, name: string) {
		const confirmed = confirm(`Revoke invitation for ${name}?`);
		if (!confirmed) return;

		revokingInvite = inviteId;
		error = '';

		try {
			const response = await fetch(`/api/invites/${inviteId}`, { method: 'DELETE' });
			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to revoke invite');
			}
			invites = invites.filter((inv) => inv.id !== inviteId);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to revoke invite';
			setTimeout(() => (error = ''), 5000);
		} finally {
			revokingInvite = null;
		}
	}

	async function renewInvite(inviteId: string, name: string) {
		renewingInvite = inviteId;
		error = '';

		try {
			const response = await fetch(`/api/invites/${inviteId}/renew`, { method: 'POST' });
			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to renew invite');
			}
			const renewedInvite = (await response.json()) as typeof invites[0];
			
			// Update local state - reassign array to trigger reactivity
			invites = invites.map((inv) => (inv.id === inviteId ? renewedInvite : inv));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to renew invite';
			setTimeout(() => (error = ''), 5000);
		} finally {
			renewingInvite = null;
		}
	}

	async function copyInviteLink(link: string, name: string) {
		try {
			await navigator.clipboard.writeText(link);
			error = ''; // Clear any existing error
			// Show brief success feedback
			const btn = document.activeElement as HTMLButtonElement;
			const originalText = btn?.textContent;
			if (btn) {
				btn.textContent = 'Copied!';
				setTimeout(() => { btn.textContent = originalText; }, 1500);
			}
		} catch {
			error = `Failed to copy link for ${name}`;
			setTimeout(() => (error = ''), 3000);
		}
	}

	async function toggleRole(memberId: string, role: 'owner' | 'admin' | 'librarian' | 'conductor' | 'section_leader') {
		const member = members.find((m: typeof members[0]) => m.id === memberId);
		if (!member) return;

		const hasRole = member.roles.includes(role);
		const action = hasRole ? 'remove' : 'add';

		// Prevent removing last owner
		if (role === 'owner' && hasRole) {
			const ownerCount = members.filter((m: typeof members[0]) => m.roles.includes('owner')).length;
			if (ownerCount <= 1) {
				error = 'Cannot remove the last owner';
				setTimeout(() => (error = ''), 3000);
				return;
			}
		}

		updatingMember = memberId;
		error = '';

		try {
			const response = await fetch(`/api/members/${memberId}/roles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role, action })
			});

			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to update role');
			}

			// Update local state - reassign array to trigger reactivity
			members = members.map((m) =>
				m.id === memberId
					? {
							...m,
							roles:
								action === 'add'
									? [...m.roles, role]
									: m.roles.filter((r: string) => r !== role)
						}
					: m
			);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update role';
			setTimeout(() => (error = ''), 5000);
		} finally {
			updatingMember = null;
		}
	}

	// TODO Phase 3: Add updateMemberVoices and updateMemberSections functions

	async function addVoice(memberId: string, voiceId: string, isPrimary: boolean = false) {
		updatingMember = memberId;
		error = '';
		showingVoiceDropdown = null;

		try {
			const response = await fetch(`/api/members/${memberId}/voices`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ voiceId, isPrimary })
			});

			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to add voice');
			}

			// Find the voice details
			const voice = data.availableVoices.find((v: { id: string }) => v.id === voiceId);
			if (voice) {
				// Update local state - add voice to member
				members = members.map((m) =>
					m.id === memberId
						? {
								...m,
								voices: isPrimary ? [voice, ...m.voices] : [...m.voices, voice]
							}
						: m
				);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add voice';
			setTimeout(() => (error = ''), 5000);
		} finally {
			updatingMember = null;
		}
	}

	async function removeVoice(memberId: string, voiceId: string) {
		updatingMember = memberId;
		error = '';

		try {
			const response = await fetch(`/api/members/${memberId}/voices`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ voiceId })
			});

			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to remove voice');
			}

			// Update local state - remove voice from member
			members = members.map((m) =>
				m.id === memberId
					? {
							...m,
							voices: m.voices.filter((v) => v.id !== voiceId)
						}
					: m
			);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove voice';
			setTimeout(() => (error = ''), 5000);
		} finally {
			updatingMember = null;
		}
	}

	async function addSection(memberId: string, sectionId: string, isPrimary: boolean = false) {
		updatingMember = memberId;
		error = '';
		showingSectionDropdown = null;

		try {
			const response = await fetch(`/api/members/${memberId}/sections`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sectionId, isPrimary })
			});

			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to add section');
			}

			// Find the section details
			const section = data.availableSections.find((s: { id: string }) => s.id === sectionId);
			if (section) {
				// Update local state - add section to member
				members = members.map((m) =>
					m.id === memberId
						? {
								...m,
								sections: isPrimary ? [section, ...m.sections] : [...m.sections, section]
							}
						: m
				);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add section';
			setTimeout(() => (error = ''), 5000);
		} finally {
			updatingMember = null;
		}
	}

	async function removeSection(memberId: string, sectionId: string) {
		updatingMember = memberId;
		error = '';

		try {
			const response = await fetch(`/api/members/${memberId}/sections`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sectionId })
			});

			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to remove section');
			}

			// Update local state - remove section from member
			members = members.map((m) =>
				m.id === memberId
					? {
							...m,
							sections: m.sections.filter((s) => s.id !== sectionId)
						}
					: m
			);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove section';
			setTimeout(() => (error = ''), 5000);
		} finally {
			updatingMember = null;
		}
	}

	async function removeMember(memberId: string, memberName: string) {
		const confirmed = confirm(
			`Are you sure you want to remove ${memberName}?\n\nThis action cannot be undone.`
		);

		if (!confirmed) return;

		removingMember = memberId;
		error = '';

		try {
			const response = await fetch(`/api/members/${memberId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to remove member');
			}

			// Remove from local state
			members = members.filter((m) => m.id !== memberId);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove member';
			setTimeout(() => (error = ''), 5000);
		} finally {
			removingMember = null;
		}
	}

	function getRoleBadgeClass(role: string): string {
		switch (role) {
			case 'owner':
				return 'bg-purple-100 text-purple-800 border-purple-200';
			case 'admin':
				return 'bg-blue-100 text-blue-800 border-blue-200';
			case 'librarian':
				return 'bg-green-100 text-green-800 border-green-200';
			case 'conductor':
				return 'bg-amber-100 text-amber-800 border-amber-200';
			case 'section_leader':
				return 'bg-teal-100 text-teal-800 border-teal-200';
			default:
				return 'bg-gray-100 text-gray-800 border-gray-200';
		}
	}
</script>

<svelte:head>
	<title>Manage Members | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Manage Members</h1>
			<p class="mt-2 text-gray-600">View and manage choir member roles and permissions</p>
		</div>
		<div class="flex gap-3">
			<a
				href="/members/add-roster"
				class="rounded-lg border border-blue-600 px-4 py-2 text-blue-600 transition hover:bg-blue-50"
			>
				+ Add Roster Member
			</a>
			<a
				href="/invite"
				class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
			>
				Invite Member
			</a>
		</div>
	</div>

	{#if error}
		<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
			{error}
		</div>
	{/if}

	{#if successMessage}
		<div class="mb-4 rounded-lg bg-green-100 p-4 text-green-700">
			{successMessage}
		</div>
	{/if}

	<!-- Pending Invitations -->
	{#if invites.length > 0}
		<div class="mb-8">
			<h2 class="mb-4 text-xl font-semibold text-gray-700">
				Pending Invitations ({invites.length})
			</h2>
			<div class="space-y-3">
				{#each invites as invite (invite.id)}
					{@const expired = isInviteExpired(invite.expiresAt)}
					<div class="flex items-center justify-between rounded-lg border p-4 {expired ? 'border-red-200 bg-red-50 opacity-75' : 'border-amber-200 bg-amber-50'}">
						<div class="flex-1">
							<div class="flex items-center gap-3">
								<span class="font-medium">{invite.name}</span>
								{#if expired}
									<span class="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
										EXPIRED
									</span>
								{/if}
								
								<!-- Role badges -->
								{#each invite.roles as role}
									<span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
										{role}
									</span>
								{/each}
								
								<!-- Voice badges -->
								{#if invite.voices && invite.voices.length > 0}
									<div class="flex gap-1">
										{#each invite.voices as voice, index}
											<span 
												class="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800"
												title="{voice.name} {index === 0 ? '(primary)' : ''}"
											>
												{#if index === 0}★{/if} {voice.abbreviation}
											</span>
										{/each}
									</div>
								{/if}
								
								<!-- Section badges -->
								{#if invite.sections && invite.sections.length > 0}
									<div class="flex gap-1">
										{#each invite.sections as section, index}
											<span 
												class="rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800"
												title="{section.name} {index === 0 ? '(primary)' : ''}"
											>
												{#if index === 0}★{/if} {section.abbreviation}
											</span>
										{/each}
									</div>
								{/if}
							</div>
							<p class="mt-1 text-sm {expired ? 'text-gray-600' : 'text-gray-500'}">
								Invited by {invite.invitedBy} · 
								{#if expired}
									Expired {new Date(invite.expiresAt).toLocaleDateString()}
								{:else}
									Expires {new Date(invite.expiresAt).toLocaleDateString()}
								{/if}
							</p>
						</div>
						<div class="flex items-center gap-2">
							<button
								onclick={() => copyInviteLink(invite.inviteLink, invite.name)}
								class="rounded px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
								title="Copy invitation link"
							>
								Copy Link
							</button>
							{#if expired}
								<button
									onclick={() => renewInvite(invite.id, invite.name)}
									disabled={renewingInvite === invite.id}
									class="rounded px-3 py-1 text-sm text-green-600 hover:bg-green-50 disabled:opacity-50"
									title="Extend expiration by 48 hours"
								>
									{renewingInvite === invite.id ? 'Renewing...' : 'Renew'}
								</button>
							{/if}
							<button
								onclick={() => revokeInvite(invite.id, invite.name)}
								disabled={revokingInvite === invite.id}
								class="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
								title="Revoke invitation"
							>
								{revokingInvite === invite.id ? 'Revoking...' : 'Revoke'}
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Search -->
	<div class="mb-6">
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="Search by email or name..."
			class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
			aria-label="Search members by email or name"
		/>
	</div>

	<!-- Members List -->
	{#if filteredMembers.length === 0}
		<div class="py-12 text-center text-gray-500">
			{#if members.length === 0}
				<p>No members yet.</p>
			{:else}
				<p>No members match your search.</p>
			{/if}
		</div>
	{:else}
		<div class="space-y-4">
			{#each filteredMembers as member (member.id)}
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm relative">
					<!-- Remove Button (top-right corner) -->
					{#if member.id !== data.currentUserId && data.isOwner}
						<button
							onclick={() => removeMember(member.id, member.name)}
							disabled={removingMember === member.id}
							class="absolute top-4 right-4 text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded hover:bg-red-50 transition"
							title="Remove {member.name} from vault"
							aria-label="Remove {member.name}"
						>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
							</svg>
						</button>
					{/if}

					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-3">
								<h3 class="text-lg font-semibold">
								{member.name}
								</h3>
								{#if member.id === data.currentUserId}
									<span 
										class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600"
										title="This is your account"
									>You</span>
								{/if}
								{#if !member.email_id}
									<span 
										class="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800"
										title="Roster-only member - cannot log in until invited"
									>ROSTER ONLY</span>
								{/if}
						</div>
					{#if member.email}
						<p class="text-sm text-gray-600">{member.email}</p>
						{/if}
						<p class="mt-1 text-xs text-gray-500">
							Joined {new Date(member.joinedAt).toLocaleDateString()}
						</p>

						<!-- Voices section with inline editing -->
						<div class="mt-3">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-gray-700">Voices:</span>
								{#if member.voices && member.voices.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each member.voices as voice, index}
											<span 
												class="group relative inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800"
												title="{voice.name} {index === 0 ? '(primary)' : ''}"
											>
												{#if index === 0}★{/if} {voice.abbreviation}
												{#if data.isAdmin && updatingMember !== member.id}
													<button
														onclick={() => removeVoice(member.id, voice.id)}
														class="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-purple-900 transition"
														title="Remove {voice.name}"
													>
														×
													</button>
												{/if}
											</span>
										{/each}
									</div>
								{/if}
								{#if data.isAdmin && updatingMember !== member.id}
									<div class="relative">
										<button
											onclick={() => showingVoiceDropdown = showingVoiceDropdown === member.id ? null : member.id}
											class="text-purple-600 hover:text-purple-800 text-xs px-2 py-0.5 rounded hover:bg-purple-50"
											title="Add voice"
										>
											+ Add
										</button>
										{#if showingVoiceDropdown === member.id}
											<div class="absolute z-10 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
												<div class="py-1">
													{#each data.availableVoices.filter(v => !member.voices.some(mv => mv.id === v.id)) as voice}
														<button
															onclick={() => addVoice(member.id, voice.id, member.voices.length === 0)}
															class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
														>
															{voice.name} ({voice.abbreviation})
														</button>
													{/each}
													{#if member.voices.length === data.availableVoices.length}
														<div class="px-4 py-2 text-sm text-gray-500">All voices assigned</div>
													{/if}
												</div>
											</div>
										{/if}
									</div>
								{/if}
							</div>
						</div>

						<!-- Sections section with inline editing -->
						<div class="mt-2">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-gray-700">Sections:</span>
								{#if member.sections && member.sections.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each member.sections as section, index}
											<span 
												class="group relative inline-flex items-center gap-1 rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800"
												title="{section.name} {index === 0 ? '(primary)' : ''}"
											>
												{#if index === 0}★{/if} {section.abbreviation}
												{#if data.isAdmin && updatingMember !== member.id}
													<button
														onclick={() => removeSection(member.id, section.id)}
														class="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-teal-900 transition"
														title="Remove {section.name}"
													>
														×
													</button>
												{/if}
											</span>
										{/each}
									</div>
								{/if}
								{#if data.isAdmin && updatingMember !== member.id}
									<div class="relative">
										<button
											onclick={() => showingSectionDropdown = showingSectionDropdown === member.id ? null : member.id}
											class="text-teal-600 hover:text-teal-800 text-xs px-2 py-0.5 rounded hover:bg-teal-50"
											title="Add section"
										>
											+ Add
										</button>
										{#if showingSectionDropdown === member.id}
											<div class="absolute z-10 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
												<div class="py-1">
													{#each data.availableSections.filter(s => !member.sections.some(ms => ms.id === s.id)) as section}
														<button
															onclick={() => addSection(member.id, section.id, member.sections.length === 0)}
															class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
														>
															{section.name} ({section.abbreviation})
														</button>
													{/each}
													{#if member.sections.length === data.availableSections.length}
														<div class="px-4 py-2 text-sm text-gray-500">All sections assigned</div>
													{/if}
												</div>
											</div>
										{/if}
									</div>
								{/if}
							</div>
						</div>
							{#if !member.email_id}
								<!-- Roster-only member - show invitation button instead of roles -->
								<div class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
									<p class="mb-2 text-sm text-amber-800">
										This member cannot log in until invited. Send them an invitation to grant system access.
									</p>
									<a
										href="/invite?name={encodeURIComponent(member.name)}"
										class="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
									>
										Send Invitation
									</a>
								</div>
							{:else}
								<!-- Registered member - show role badges -->
								{#each ASSIGNABLE_ROLES as role}
									{@const isDisabled = updatingMember === member.id || 
										(member.id === data.currentUserId && role === 'owner') ||
										(!data.isOwner && role === 'owner')}
									{@const hasRole = member.roles.includes(role)}
									<button
										onclick={() => toggleRole(member.id, role)}
										disabled={isDisabled}
										class="rounded-full border px-3 py-1 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 {hasRole
											? getRoleBadgeClass(role)
											: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
										title={isDisabled && member.id === data.currentUserId && role === 'owner'
											? 'Cannot remove your own owner role'
											: isDisabled && !data.isOwner && role === 'owner'
												? 'Only owners can manage owner role'
												: hasRole 
													? `Remove ${role} role`
													: `Add ${role} role`}
									aria-label="{hasRole ? 'Remove' : 'Add'} {role} role for {member.name}"
									>
										{#if member.roles.includes(role)}
											✓ {role}
										{:else}
											+ {role}
										{/if}
									</button>
								{/each}

								{#if member.roles.length === 0}
									<span class="text-sm text-gray-500">No roles assigned</span>
								{/if}
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<p class="mt-6 text-sm text-gray-500">
		{filteredMembers.length} of {members.length} members
	</p>
</div>
