<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { ASSIGNABLE_ROLES } from '$lib/types';
	import EditionFileActions from '$lib/components/EditionFileActions.svelte';
	import Card from '$lib/components/Card.svelte';
	import { VoiceBadge, SectionBadge } from '$lib/components/badges';
	import { getRoleBadgeClass } from '$lib/utils/badges';
	import { toast } from '$lib/stores/toast';

	let { data }: { data: PageData } = $props();

	// Make a reactive copy of member for local updates
	let member = $state(untrack(() => data.member));
	let updating = $state(false);
	let showingVoiceDropdown = $state(false);
	let showingSectionDropdown = $state(false);

	// Inline name editing state
	let isEditingName = $state(false);
	let editedName = $state('');

	// Inline nickname editing state
	let isEditingNickname = $state(false);
	let editedNickname = $state('');

	// Watch for data changes and update local state
	$effect(() => {
		member = data.member;
	});

	function startEditingName() {
		if (!data.isAdmin) return;
		editedName = member.name;
		isEditingName = true;
	}

	async function saveName() {
		const trimmedName = editedName.trim();
		
		// If unchanged or empty, just cancel
		if (!trimmedName || trimmedName === member.name) {
			isEditingName = false;
			return;
		}

		updating = true;

		try {
			const response = await fetch(`/api/members/${member.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: trimmedName })
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to update name');
			}

			// Update local state
			member = { ...member, name: trimmedName };
			isEditingName = false;
			toast.success('Name updated successfully');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to update name');
		} finally {
			updating = false;
		}
	}

	function handleNameKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			saveName();
		} else if (event.key === 'Escape') {
			isEditingName = false;
		}
	}

	function startEditingNickname() {
		if (!data.isAdmin) return;
		editedNickname = member.nickname ?? '';
		isEditingNickname = true;
	}

	async function saveNickname() {
		const trimmedNickname = editedNickname.trim();
		
		// If unchanged, just cancel
		if (trimmedNickname === (member.nickname ?? '')) {
			isEditingNickname = false;
			return;
		}

		updating = true;

		try {
			const response = await fetch(`/api/members/${member.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nickname: trimmedNickname || null })
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to update nickname');
			}

			// Update local state
			member = { ...member, nickname: trimmedNickname || null };
			isEditingNickname = false;
			toast.success(trimmedNickname ? 'Nickname updated' : 'Nickname cleared');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to update nickname');
		} finally {
			updating = false;
		}
	}

	function handleNicknameKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			saveNickname();
		} else if (event.key === 'Escape') {
			isEditingNickname = false;
		}
	}

	async function toggleRole(role: 'owner' | 'admin' | 'librarian' | 'conductor' | 'section_leader') {
		const hasRole = member.roles.includes(role);
		const action = hasRole ? 'remove' : 'add';

		// Prevent removing last owner
		if (role === 'owner' && hasRole && data.ownerCount <= 1) {
			toast.error('Cannot remove the last owner');
			return;
		}

		updating = true;

		try {
			const response = await fetch(`/api/members/${member.id}/roles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role, action })
			});

			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to update role');
			}

			// Update local state
			member = {
				...member,
				roles: action === 'add'
					? [...member.roles, role]
					: member.roles.filter((r) => r !== role)
			};
			toast.success(`Role ${action === 'add' ? 'added' : 'removed'} successfully`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to update role');
		} finally {
			updating = false;
		}
	}

	async function addVoice(voiceId: string, isPrimary: boolean = false) {
		updating = true;
		showingVoiceDropdown = false;

		try {
			const response = await fetch(`/api/members/${member.id}/voices`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ voiceId, isPrimary })
			});

			if (!response.ok) {
				const respData = (await response.json()) as { message?: string };
				throw new Error(respData.message ?? 'Failed to add voice');
			}

			const voice = data.availableVoices.find((v) => v.id === voiceId);
			if (voice) {
				member = {
					...member,
					voices: isPrimary ? [voice, ...member.voices] : [...member.voices, voice]
				};
			}
			toast.success('Voice added successfully');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to add voice');
		} finally {
			updating = false;
		}
	}

	async function removeVoice(voiceId: string) {
		updating = true;

		try {
			const response = await fetch(`/api/members/${member.id}/voices`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ voiceId })
			});

			if (!response.ok) {
				const respData = (await response.json()) as { message?: string };
				throw new Error(respData.message ?? 'Failed to remove voice');
			}

			member = {
				...member,
				voices: member.voices.filter((v) => v.id !== voiceId)
			};
			toast.success('Voice removed successfully');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to remove voice');
		} finally {
			updating = false;
		}
	}

	async function addSection(sectionId: string, isPrimary: boolean = false) {
		updating = true;
		showingSectionDropdown = false;

		try {
			const response = await fetch(`/api/members/${member.id}/sections`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sectionId, isPrimary })
			});

			if (!response.ok) {
				const respData = (await response.json()) as { message?: string };
				throw new Error(respData.message ?? 'Failed to add section');
			}

			const section = data.availableSections.find((s) => s.id === sectionId);
			if (section) {
				member = {
					...member,
					sections: isPrimary ? [section, ...member.sections] : [...member.sections, section]
				};
			}
			toast.success('Section added successfully');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to add section');
		} finally {
			updating = false;
		}
	}

	async function removeSection(sectionId: string) {
		updating = true;

		try {
			const response = await fetch(`/api/members/${member.id}/sections`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sectionId })
			});

			if (!response.ok) {
				const respData = (await response.json()) as { message?: string };
				throw new Error(respData.message ?? 'Failed to remove section');
			}

			member = {
				...member,
				sections: member.sections.filter((s) => s.id !== sectionId)
			};
			toast.success('Section removed successfully');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to remove section');
		} finally {
			updating = false;
		}
	}

	async function removeMember() {
		const confirmed = confirm(
			`Are you sure you want to remove ${member.name}?\n\nThis action cannot be undone.`
		);

		if (!confirmed) return;

		updating = true;

		try {
			const response = await fetch(`/api/members/${member.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const respData = (await response.json()) as { message?: string };
				throw new Error(respData.message ?? 'Failed to remove member');
			}

			// Navigate back to members list
			goto('/members');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to remove member');
			updating = false;
		}
	}
</script>

<svelte:head>
	<title>{member.name} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
	<!-- Back link -->
	<a
		href="/members"
		class="mb-6 inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline"
	>
		← Back to Members
	</a>

	<div class="mb-8 flex items-center justify-between">
		{#if isEditingName}
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				bind:value={editedName}
				onblur={saveName}
				onkeydown={handleNameKeydown}
				disabled={updating}
				class="text-3xl font-bold border-b-2 border-blue-500 bg-transparent outline-none w-full max-w-md px-1 py-0.5"
				autofocus
			/>
		{:else if data.isAdmin}
			<button 
				type="button"
				onclick={startEditingName}
				class="text-3xl font-bold cursor-pointer hover:text-blue-600 text-left"
				title="Click to edit name"
			>{member.name}</button>
		{:else}
			<h1 class="text-3xl font-bold">{member.name}</h1>
		{/if}
		
		<!-- Remove button for admins (not for self or last owner) -->
		{#if data.isOwner && member.id !== data.currentUserId}
			<button
				onclick={removeMember}
				disabled={updating}
				class="rounded-lg border border-red-600 px-4 py-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
			>
				Remove Member
			</button>
		{/if}
	</div>

	<!-- Nickname (editable by admin) -->
	<div class="mb-6 -mt-4">
		{#if isEditingNickname}
			<div class="flex items-center gap-2">
				<span class="text-sm text-gray-500">Nickname:</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					bind:value={editedNickname}
					onblur={saveNickname}
					onkeydown={handleNicknameKeydown}
					disabled={updating}
					placeholder="Enter nickname..."
					class="text-lg border-b-2 border-blue-500 bg-transparent outline-none px-1 py-0.5"
					autofocus
				/>
			</div>
		{:else if data.isAdmin}
			<button 
				type="button"
				onclick={startEditingNickname}
				class="text-gray-500 hover:text-blue-600 cursor-pointer text-sm"
				title="Click to edit nickname"
			>
				{#if member.nickname}
					<span class="text-gray-500">Nickname:</span> <span class="text-gray-700">{member.nickname}</span>
				{:else}
					<span class="italic">+ Add nickname</span>
				{/if}
			</button>
		{:else if member.nickname}
			<p class="text-sm text-gray-500">Nickname: <span class="text-gray-700">{member.nickname}</span></p>
		{/if}
	</div>

	<Card padding="lg">
		<!-- Registration Status -->
		{#if !member.email_id}
			<div class="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
				<div class="flex items-center justify-between">
					<div>
						<span class="font-medium text-amber-800">Roster-only member</span>
						<p class="mt-1 text-sm text-amber-700">
							This member has not yet completed OAuth registration.
						</p>
					</div>
					{#if data.isAdmin}
						<a
							href="/invite?rosterId={member.id}"
							class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
						>
							Send Invitation
						</a>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Roles -->
		<div class="mb-6">
			<h2 class="mb-2 text-sm font-medium text-gray-700">Roles</h2>
			{#if data.isAdmin && member.email_id}
				<!-- Editable roles for admins (only for registered members) -->
				<div class="flex flex-wrap gap-2">
					{#each ASSIGNABLE_ROLES as role}
						{@const isDisabled = updating || 
							(member.id === data.currentUserId && role === 'owner') ||
							(!data.isOwner && role === 'owner')}
						{@const hasRole = member.roles.includes(role)}
						<button
							onclick={() => toggleRole(role)}
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
						>
							{#if hasRole}
								✓ {role}
							{:else}
								+ {role}
							{/if}
						</button>
					{/each}
				</div>
			{:else if member.roles.length > 0}
				<!-- Read-only roles display -->
				<div class="flex flex-wrap gap-2">
					{#each member.roles as role}
						<span class="rounded-full px-3 py-1 text-sm font-medium {getRoleBadgeClass(role)}">
							{role}
						</span>
					{/each}
				</div>
			{:else}
				<span class="text-gray-500">No roles assigned</span>
			{/if}
		</div>

		<!-- Voices -->
		<div class="mb-6">
			<h2 class="mb-2 text-sm font-medium text-gray-700">Voices</h2>
			<div class="flex flex-wrap items-center gap-2">
				{#if member.voices.length > 0}
					{#each member.voices as voice, index}
						<VoiceBadge
							{voice}
							isPrimary={index === 0}
							showFullName
							size="md"
							removable={data.isAdmin}
							disabled={updating}
							onRemove={() => removeVoice(voice.id)}
						/>
					{/each}
				{:else}
					<span class="text-gray-500">No voices assigned</span>
				{/if}
				
				{#if data.isAdmin && !updating}
					<div class="relative">
						<button
							onclick={() => showingVoiceDropdown = !showingVoiceDropdown}
							class="text-purple-600 hover:text-purple-800 text-sm px-2 py-1 rounded hover:bg-purple-50"
						>
							+ Add Voice
						</button>
						{#if showingVoiceDropdown}
							<div class="absolute z-10 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
								<div class="py-1">
									{#each data.availableVoices.filter(v => !member.voices.some(mv => mv.id === v.id)) as voice}
										<button
											onclick={() => addVoice(voice.id, member.voices.length === 0)}
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

		<!-- Sections -->
		<div class="mb-6">
			<h2 class="mb-2 text-sm font-medium text-gray-700">Sections</h2>
			<div class="flex flex-wrap items-center gap-2">
				{#if member.sections.length > 0}
					{#each member.sections as section, index}
						<SectionBadge
							{section}
							isPrimary={index === 0}
							showFullName
							size="md"
							removable={data.isAdmin}
							disabled={updating}
							onRemove={() => removeSection(section.id)}
						/>
					{/each}
				{:else}
					<span class="text-gray-500">No sections assigned</span>
				{/if}
				
				{#if data.isAdmin && !updating}
					<div class="relative">
						<button
							onclick={() => showingSectionDropdown = !showingSectionDropdown}
							class="text-teal-600 hover:text-teal-800 text-sm px-2 py-1 rounded hover:bg-teal-50"
						>
							+ Add Section
						</button>
						{#if showingSectionDropdown}
							<div class="absolute z-10 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
								<div class="py-1">
									{#each data.availableSections.filter(s => !member.sections.some(ms => ms.id === s.id)) as section}
										<button
											onclick={() => addSection(section.id, member.sections.length === 0)}
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

		<!-- Member Since -->
		<div>
			<h2 class="mb-2 text-sm font-medium text-gray-700">Member Since</h2>
			<span class="text-gray-900">{new Date(member.joined_at).toLocaleDateString()}</span>
		</div>
	</Card>

	<!-- My Scores Section - Only visible to profile owner or admins -->
	{#if data.assignedCopies}
		<Card padding="lg" class="mt-8">
			<h2 class="mb-4 text-xl font-semibold text-gray-900">
				{data.isOwnProfile ? 'My Scores' : 'Assigned Scores'}
			</h2>
			
			{#if data.assignedCopies.length === 0}
				<p class="text-gray-500">
					{data.isOwnProfile 
						? 'You have no physical copies assigned to you yet.' 
						: 'No physical copies assigned to this member.'}
				</p>
			{:else}
				<div class="divide-y divide-gray-100">
					{#each data.assignedCopies as copy (copy.assignmentId)}
						<div class="py-4 first:pt-0 last:pb-0">
							<div class="flex items-start justify-between">
								<div>
									<h3 class="font-medium text-gray-900">
										{copy.work.title}
									</h3>
									{#if copy.work.composer}
										<p class="text-sm text-gray-600">{copy.work.composer}</p>
									{/if}
									<p class="mt-1 text-sm text-gray-500">
										{copy.edition.name} · Copy #{copy.copyNumber}
									</p>
									<p class="mt-1 text-xs text-gray-400">
										Assigned {new Date(copy.assignedAt).toLocaleDateString()}
									</p>
								</div>
								
								<!-- Digital access link if available -->
								<EditionFileActions
									editionId={copy.edition.id}
									fileKey={copy.edition.fileKey}
									externalUrl={copy.edition.externalUrl}
									size="sm"
								/>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card>	{/if}
</div>