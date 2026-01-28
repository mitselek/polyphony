<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { ASSIGNABLE_ROLES } from '$lib/types';

	let { data }: { data: PageData } = $props();

	// Make a reactive copy of member for local updates
	let member = $state(untrack(() => data.member));
	let updating = $state(false);
	let error = $state('');
	let successMessage = $state('');
	let showingVoiceDropdown = $state(false);
	let showingSectionDropdown = $state(false);

	// Watch for data changes and update local state
	$effect(() => {
		member = data.member;
	});

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

	async function toggleRole(role: 'owner' | 'admin' | 'librarian' | 'conductor' | 'section_leader') {
		const hasRole = member.roles.includes(role);
		const action = hasRole ? 'remove' : 'add';

		// Prevent removing last owner
		if (role === 'owner' && hasRole && data.ownerCount <= 1) {
			error = 'Cannot remove the last owner';
			setTimeout(() => (error = ''), 3000);
			return;
		}

		updating = true;
		error = '';

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
			successMessage = `Role ${action === 'add' ? 'added' : 'removed'} successfully`;
			setTimeout(() => (successMessage = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update role';
			setTimeout(() => (error = ''), 5000);
		} finally {
			updating = false;
		}
	}

	async function addVoice(voiceId: string, isPrimary: boolean = false) {
		updating = true;
		error = '';
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
			successMessage = 'Voice added successfully';
			setTimeout(() => (successMessage = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add voice';
			setTimeout(() => (error = ''), 5000);
		} finally {
			updating = false;
		}
	}

	async function removeVoice(voiceId: string) {
		updating = true;
		error = '';

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
			successMessage = 'Voice removed successfully';
			setTimeout(() => (successMessage = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove voice';
			setTimeout(() => (error = ''), 5000);
		} finally {
			updating = false;
		}
	}

	async function addSection(sectionId: string, isPrimary: boolean = false) {
		updating = true;
		error = '';
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
			successMessage = 'Section added successfully';
			setTimeout(() => (successMessage = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add section';
			setTimeout(() => (error = ''), 5000);
		} finally {
			updating = false;
		}
	}

	async function removeSection(sectionId: string) {
		updating = true;
		error = '';

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
			successMessage = 'Section removed successfully';
			setTimeout(() => (successMessage = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove section';
			setTimeout(() => (error = ''), 5000);
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
		error = '';

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
			error = err instanceof Error ? err.message : 'Failed to remove member';
			setTimeout(() => (error = ''), 5000);
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
		<h1 class="text-3xl font-bold">{member.name}</h1>
		
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

	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
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
							href="/invite?name={encodeURIComponent(member.name)}&voices={member.voices.map(v => v.id).join(',')}&sections={member.sections.map(s => s.id).join(',')}"
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
						<span
							class="group relative inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800"
							title="{voice.name} {index === 0 ? '(primary)' : ''}"
						>
							{#if index === 0}★{/if}
							{voice.name} ({voice.abbreviation})
							{#if data.isAdmin && !updating}
								<button
									onclick={() => removeVoice(voice.id)}
									class="ml-1 opacity-0 group-hover:opacity-100 hover:text-purple-900 transition"
									title="Remove {voice.name}"
								>
									×
								</button>
							{/if}
						</span>
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
						<span
							class="group relative inline-flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-800"
							title="{section.name} {index === 0 ? '(primary)' : ''}"
						>
							{#if index === 0}★{/if}
							{section.name} ({section.abbreviation})
							{#if data.isAdmin && !updating}
								<button
									onclick={() => removeSection(section.id)}
									class="ml-1 opacity-0 group-hover:opacity-100 hover:text-teal-900 transition"
									title="Remove {section.name}"
								>
									×
								</button>
							{/if}
						</span>
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
	</div>
</div>
