<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Make a reactive copy of members for local updates
	// Using untrack to intentionally capture only initial value
	// The $effect below will handle subsequent updates
	let members = $state(untrack(() => data.members));
	let searchQuery = $state('');
	let updatingMember = $state<string | null>(null);
	let error = $state('');
	let success = $state('');

	// Watch for data changes (e.g., on navigation) and update local state
	$effect(() => {
		members = data.members;
	});

	let filteredMembers = $derived(
		members.filter(
			(m: typeof members[0]) =>
				m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
		)
	);

	async function toggleRole(memberId: string, role: 'owner' | 'admin' | 'librarian') {
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
		success = '';

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

			success = `${action === 'add' ? 'Added' : 'Removed'} ${role} role`;
			setTimeout(() => (success = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update role';
			setTimeout(() => (error = ''), 5000);
		} finally {
			updatingMember = null;
		}
	}

	async function updateVoicePart(memberId: string, voicePart: string | null) {
		updatingMember = memberId;
		error = '';

		try {
			const response = await fetch(`/api/members/${memberId}/voice-part`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ voicePart })
			});

			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to update voice part');
			}

			// Update local state - reassign array to trigger reactivity
			members = members.map((m) =>
				m.id === memberId ? { ...m, voicePart } : m
			);

			success = 'Voice part updated';
			setTimeout(() => (success = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update voice part';
			setTimeout(() => (error = ''), 5000);
		} finally {
			updatingMember = null;
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
		<a
			href="/invite"
			class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
		>
			Invite Member
		</a>
	</div>

	{#if error}
		<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
			{error}
		</div>
	{/if}

	{#if success}
		<div class="mb-4 rounded-lg bg-green-100 p-4 text-green-700">
			{success}
		</div>
	{/if}

	<!-- Search -->
	<div class="mb-6">
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="Search by email or name..."
			class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-3">
								<h3 class="text-lg font-semibold">
									{member.name ?? member.email}
								</h3>
								{#if member.id === data.currentUserId}
									<span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600"
										>You</span
									>
								{/if}
							</div>
							{#if member.name}
								<p class="text-sm text-gray-600">{member.email}</p>
							{/if}
							<p class="mt-1 text-xs text-gray-500">
								Joined {new Date(member.joinedAt).toLocaleDateString()}
							</p>
						</div>

						<!-- Voice Part -->
						<div class="ml-4">
						<label for="voice-part-{member.id}" class="block text-xs font-medium text-gray-700">Voice Part</label>
						<select
							id="voice-part-{member.id}"
								value={member.voicePart ?? ''}
								onchange={(e) => updateVoicePart(member.id, e.currentTarget.value || null)}
								disabled={updatingMember === member.id}
								class="mt-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
							>
								<option value="">None</option>
								<option value="S">S</option>
								<option value="A">A</option>
								<option value="T">T</option>
								<option value="B">B</option>
								<option value="SA">SA</option>
								<option value="AT">AT</option>
								<option value="TB">TB</option>
								<option value="SAT">SAT</option>
								<option value="ATB">ATB</option>
								<option value="SATB">SATB</option>
							</select>
						</div>
					</div>

					<!-- Roles -->
					<div class="mt-4">
						<p class="mb-2 text-sm font-medium text-gray-700">Roles:</p>
						<div class="flex flex-wrap gap-2">
							{#each (['owner', 'admin', 'librarian'] as const) as role}
								{@const isDisabled = updatingMember === member.id || 
									(member.id === data.currentUserId && role === 'owner') ||
									(!data.isOwner && role === 'owner')}
								<button
									onclick={() => toggleRole(member.id, role)}
									disabled={isDisabled}
									class="rounded-full border px-3 py-1 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 {member.roles.includes(role)
										? getRoleBadgeClass(role)
										: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
									title={isDisabled && member.id === data.currentUserId && role === 'owner'
										? 'Cannot remove your own owner role'
										: isDisabled && !data.isOwner && role === 'owner'
											? 'Only owners can manage owner role'
											: ''}
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
