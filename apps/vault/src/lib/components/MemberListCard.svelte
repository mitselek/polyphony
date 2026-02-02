<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { VoiceBadge, SectionBadge } from '$lib/components/badges';
	import { ASSIGNABLE_ROLES } from '$lib/types';
	import type { Role, Voice, Section } from '$lib/types';
	import { getRoleBadgeClass } from '$lib/utils/badges';
	import { toast } from '$lib/stores/toast';

	export interface DisplayMember {
		id: string;
		name: string;
		nickname?: string | null;
		email?: string | null;
		email_id?: string | null;
		roles: Role[];
		voices: Voice[];
		sections: Section[];
		joinedAt: string;
	}

	interface Props {
		members: DisplayMember[];
		currentUserId: string;
		isOwner: boolean;
		isAdmin: boolean;
		availableVoices: Voice[];
		availableSections: Section[];
		pendingInviteLinks: Record<string, string>; // memberId -> inviteLink
		searchQuery: string;
		onToggleRole: (memberId: string, role: Role) => Promise<void>;
		onAddVoice: (memberId: string, voiceId: string, isPrimary: boolean) => Promise<void>;
		onRemoveVoice: (memberId: string, voiceId: string) => Promise<void>;
		onAddSection: (memberId: string, sectionId: string, isPrimary: boolean) => Promise<void>;
		onRemoveSection: (memberId: string, sectionId: string) => Promise<void>;
		onRemoveMember: (memberId: string, memberName: string) => Promise<void>;
		updatingMember: string | null;
		removingMember: string | null;
	}

	let {
		members = $bindable(),
		currentUserId,
		isOwner,
		isAdmin,
		availableVoices,
		availableSections,
		pendingInviteLinks,
		searchQuery,
		onToggleRole,
		onAddVoice,
		onRemoveVoice,
		onAddSection,
		onRemoveSection,
		onRemoveMember,
		updatingMember,
		removingMember
	}: Props = $props();

	let showingVoiceDropdown = $state<string | null>(null);
	let showingSectionDropdown = $state<string | null>(null);

	// Helper to copy invite link
	async function copyInviteLink(link: string, memberName: string) {
		try {
			await navigator.clipboard.writeText(link);
			toast.success(`Invite link copied for ${memberName}`);
		} catch {
			toast.error('Failed to copy link');
		}
	}

	let filteredMembers = $derived(
		members.filter(
			(m) =>
				(m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
				m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(m.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
		)
	);

	function handleAddVoice(memberId: string, voiceId: string, hasNoVoices: boolean) {
		showingVoiceDropdown = null;
		onAddVoice(memberId, voiceId, hasNoVoices);
	}

	function handleAddSection(memberId: string, sectionId: string, hasNoSections: boolean) {
		showingSectionDropdown = null;
		onAddSection(memberId, sectionId, hasNoSections);
	}
</script>

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
			<Card variant="interactive" padding="lg" class="relative">
				<!-- Remove Button (top-right corner) -->
				{#if member.id !== currentUserId && isOwner}
					<button
						onclick={() => onRemoveMember(member.id, member.name)}
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
								<a
									href="/members/{member.id}"
									class="hover:text-blue-600 hover:underline"
								>
									{member.nickname ?? member.name}{#if member.nickname} <span class="text-gray-400 font-normal">({member.name})</span>{/if}
								</a>
							</h3>
							{#if member.id === currentUserId}
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
										<VoiceBadge
											{voice}
											isPrimary={index === 0}
											removable={isAdmin}
											disabled={updatingMember === member.id}
											onRemove={() => onRemoveVoice(member.id, voice.id)}
										/>
										{/each}
									</div>
								{/if}
								{#if isAdmin && updatingMember !== member.id}
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
													{#each availableVoices.filter(v => !member.voices.some(mv => mv.id === v.id)) as voice}
														<button
															onclick={() => handleAddVoice(member.id, voice.id, member.voices.length === 0)}
															class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
														>
															{voice.name} ({voice.abbreviation})
														</button>
													{/each}
													{#if member.voices.length === availableVoices.length}
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
										<SectionBadge
											{section}
											isPrimary={index === 0}
											removable={isAdmin}
											disabled={updatingMember === member.id}
											onRemove={() => onRemoveSection(member.id, section.id)}
										/>
										{/each}
									</div>
								{/if}
								{#if isAdmin && updatingMember !== member.id}
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
													{#each availableSections.filter(s => !member.sections.some(ms => ms.id === s.id)) as section}
														<button
															onclick={() => handleAddSection(member.id, section.id, member.sections.length === 0)}
															class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
														>
															{section.name} ({section.abbreviation})
														</button>
													{/each}
													{#if member.sections.length === availableSections.length}
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
							<!-- Roster-only member - show invitation status or button -->
							{@const inviteLink = pendingInviteLinks[member.id]}
							<div class="mt-3 rounded-lg border {inviteLink ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'} p-3">
								{#if inviteLink}
									<div class="flex items-center justify-between">
										<p class="text-sm text-blue-800">
											<span class="font-medium">Invitation pending</span> — waiting for member to accept.
										</p>
										<button
											onclick={() => copyInviteLink(inviteLink, member.name)}
											class="rounded px-3 py-1 text-sm text-blue-600 hover:bg-blue-100"
										>
											Copy Link
										</button>
									</div>
								{:else}
									<p class="mb-2 text-sm text-amber-800">
										This member cannot log in until invited. Send them an invitation to grant system access.
									</p>
									<a
										href="/invite?rosterId={member.id}"
										class="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
									>
										Send Invitation
									</a>
								{/if}
							</div>
						{:else}
							<!-- Registered member - show role badges -->
							{#each ASSIGNABLE_ROLES as role}
								{@const isDisabled = updatingMember === member.id || 
									(member.id === currentUserId && role === 'owner') ||
									(!isOwner && role === 'owner')}
								{@const hasRole = member.roles.includes(role)}
								<button
									onclick={() => onToggleRole(member.id, role)}
									disabled={isDisabled}
									class="rounded-full border px-3 py-1 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 {hasRole
										? getRoleBadgeClass(role)
										: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
									title={isDisabled && member.id === currentUserId && role === 'owner'
										? 'Cannot remove your own owner role'
										: isDisabled && !isOwner && role === 'owner'
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
			</Card>
		{/each}
	</div>
{/if}

<p class="mt-6 text-sm text-gray-500">
	{filteredMembers.length} of {members.length} members
</p>
