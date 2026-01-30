<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import PendingInvitesCard from '$lib/components/PendingInvitesCard.svelte';
	import MemberListCard from '$lib/components/MemberListCard.svelte';
	import type { Invite } from '$lib/components/PendingInvitesCard.svelte';
	import type { DisplayMember } from '$lib/components/MemberListCard.svelte';
	import type { Role } from '$lib/types';
	import { toast } from '$lib/stores/toast';

	let { data }: { data: PageData } = $props();

	// Make reactive copies of data for local updates
	let members = $state(untrack(() => data.members as DisplayMember[]));
	let invites = $state(untrack(() => data.invites as Invite[]));
	
	// UI state
	let searchQuery = $state('');
	let updatingMember = $state<string | null>(null);
	let removingMember = $state<string | null>(null);
	let revokingInvite = $state<string | null>(null);
	let renewingInvite = $state<string | null>(null);

	// Watch for data changes (e.g., on navigation) and update local state
	$effect(() => {
		members = data.members as DisplayMember[];
		invites = data.invites as Invite[];
	});

	// Check for success message from query param
	$effect(() => {
		const addedName = $page.url.searchParams.get('added');
		if (addedName) {
			toast.success(`Successfully added roster member "${addedName}"`);
			// Remove query param from URL without reload
			const url = new URL($page.url);
			url.searchParams.delete('added');
			history.replaceState({}, '', url);
		}
	});

	// ============================================================================
	// INVITE OPERATIONS
	// ============================================================================

	async function revokeInvite(inviteId: string, name: string) {
		const confirmed = confirm(`Revoke invitation for ${name}?`);
		if (!confirmed) return;

		revokingInvite = inviteId;

		try {
			const response = await fetch(`/api/invites/${inviteId}`, { method: 'DELETE' });
			if (!response.ok) {
				const result = (await response.json()) as { message?: string };
				throw new Error(result.message ?? 'Failed to revoke invite');
			}
			invites = invites.filter((inv) => inv.id !== inviteId);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to revoke invite');
		} finally {
			revokingInvite = null;
		}
	}

	async function renewInvite(inviteId: string, name: string) {
		renewingInvite = inviteId;

		try {
			const response = await fetch(`/api/invites/${inviteId}/renew`, { method: 'POST' });
			if (!response.ok) {
				const result = (await response.json()) as { message?: string };
				throw new Error(result.message ?? 'Failed to renew invite');
			}
			const renewedInvite = (await response.json()) as Invite;
			invites = invites.map((inv) => (inv.id === inviteId ? renewedInvite : inv));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to renew invite');
		} finally {
			renewingInvite = null;
		}
	}

	async function copyInviteLink(link: string, name: string) {
		try {
			await navigator.clipboard.writeText(link);
			const btn = document.activeElement as HTMLButtonElement;
			const originalText = btn?.textContent;
			if (btn) {
				btn.textContent = 'Copied!';
				setTimeout(() => { btn.textContent = originalText; }, 1500);
			}
		} catch {
			toast.error(`Failed to copy link for ${name}`);
		}
	}

	// ============================================================================
	// MEMBER OPERATIONS
	// ============================================================================

	async function toggleRole(memberId: string, role: Role) {
		const member = members.find((m) => m.id === memberId);
		if (!member) return;

		const hasRole = member.roles.includes(role);
		const action = hasRole ? 'remove' : 'add';

		// Prevent removing last owner
		if (role === 'owner' && hasRole) {
			const ownerCount = members.filter((m) => m.roles.includes('owner')).length;
			if (ownerCount <= 1) {
				toast.error('Cannot remove the last owner');
				return;
			}
		}

		updatingMember = memberId;

		try {
			const response = await fetch(`/api/members/${memberId}/roles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role, action })
			});

			if (!response.ok) {
				const result = (await response.json()) as { message?: string };
				throw new Error(result.message ?? 'Failed to update role');
			}

			members = members.map((m) =>
				m.id === memberId
					? {
							...m,
							roles: action === 'add'
								? [...m.roles, role]
								: m.roles.filter((r) => r !== role)
						}
					: m
			);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to update role');
		} finally {
			updatingMember = null;
		}
	}

	async function addVoice(memberId: string, voiceId: string, isPrimary: boolean) {
		updatingMember = memberId;

		try {
			const response = await fetch(`/api/members/${memberId}/voices`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ voiceId, isPrimary })
			});

			if (!response.ok) {
				const result = (await response.json()) as { message?: string };
				throw new Error(result.message ?? 'Failed to add voice');
			}

			const voice = data.availableVoices.find((v: { id: string }) => v.id === voiceId);
			if (voice) {
				members = members.map((m) =>
					m.id === memberId
						? { ...m, voices: isPrimary ? [voice, ...m.voices] : [...m.voices, voice] }
						: m
				);
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to add voice');
		} finally {
			updatingMember = null;
		}
	}

	async function removeVoice(memberId: string, voiceId: string) {
		updatingMember = memberId;

		try {
			const response = await fetch(`/api/members/${memberId}/voices`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ voiceId })
			});

			if (!response.ok) {
				const result = (await response.json()) as { message?: string };
				throw new Error(result.message ?? 'Failed to remove voice');
			}

			members = members.map((m) =>
				m.id === memberId
					? { ...m, voices: m.voices.filter((v) => v.id !== voiceId) }
					: m
			);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to remove voice');
		} finally {
			updatingMember = null;
		}
	}

	async function addSection(memberId: string, sectionId: string, isPrimary: boolean) {
		updatingMember = memberId;

		try {
			const response = await fetch(`/api/members/${memberId}/sections`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sectionId, isPrimary })
			});

			if (!response.ok) {
				const result = (await response.json()) as { message?: string };
				throw new Error(result.message ?? 'Failed to add section');
			}

			const section = data.availableSections.find((s: { id: string }) => s.id === sectionId);
			if (section) {
				members = members.map((m) =>
					m.id === memberId
						? { ...m, sections: isPrimary ? [section, ...m.sections] : [...m.sections, section] }
						: m
				);
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to add section');
		} finally {
			updatingMember = null;
		}
	}

	async function removeSection(memberId: string, sectionId: string) {
		updatingMember = memberId;

		try {
			const response = await fetch(`/api/members/${memberId}/sections`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sectionId })
			});

			if (!response.ok) {
				const result = (await response.json()) as { message?: string };
				throw new Error(result.message ?? 'Failed to remove section');
			}

			members = members.map((m) =>
				m.id === memberId
					? { ...m, sections: m.sections.filter((s) => s.id !== sectionId) }
					: m
			);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to remove section');
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

		try {
			const response = await fetch(`/api/members/${memberId}`, { method: 'DELETE' });

			if (!response.ok) {
				const result = (await response.json()) as { message?: string };
				throw new Error(result.message ?? 'Failed to remove member');
			}

			members = members.filter((m) => m.id !== memberId);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to remove member');
		} finally {
			removingMember = null;
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

	<!-- Pending Invitations -->
	<PendingInvitesCard
		bind:invites
		onRevoke={revokeInvite}
		onRenew={renewInvite}
		onCopyLink={copyInviteLink}
		{revokingInvite}
		{renewingInvite}
	/>

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
	<MemberListCard
		bind:members
		currentUserId={data.currentUserId}
		isOwner={data.isOwner}
		isAdmin={data.isAdmin}
		availableVoices={data.availableVoices}
		availableSections={data.availableSections}
		{searchQuery}
		onToggleRole={toggleRole}
		onAddVoice={addVoice}
		onRemoveVoice={removeVoice}
		onAddSection={addSection}
		onRemoveSection={removeSection}
		onRemoveMember={removeMember}
		{updatingMember}
		{removingMember}
	/>
</div>
