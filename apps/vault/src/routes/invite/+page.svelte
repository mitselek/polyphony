<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let roles = $state<Set<'owner' | 'admin' | 'librarian'>>(new Set());
	let voicePart = $state<string | null>(null);
	let isSubmitting = $state(false);
	let error = $state('');
	let success = $state('');

	function toggleRole(role: 'owner' | 'admin' | 'librarian') {
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

		if (!email) {
			error = 'Email is required';
			return;
		}

		if (roles.size === 0) {
			error = 'At least one role must be selected';
			return;
		}

		isSubmitting = true;
		error = '';
		success = '';

		try {
			const response = await fetch('/api/members/invite', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					email,
					roles: Array.from(roles),
					voicePart: voicePart || null
				})
			});

			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to send invite');
			}

			success = `Invitation sent to ${email}!`;
			email = '';
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
		<a href="/library" class="text-blue-600 hover:underline">← Back to Library</a>
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
				{success}
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				<label for="email" class="mb-1 block text-sm font-medium text-gray-700">
					Email Address *
				</label>
				<input
					type="email"
					id="email"
					bind:value={email}
					required
					disabled={isSubmitting}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
					placeholder="member@example.com"
				/>
			</div>

			<fieldset>
				<legend class="mb-2 block text-sm font-medium text-gray-700">
					Roles * (select at least one)
				</legend>
				<div class="space-y-2">
					{#if data.isOwner}
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								checked={roles.has('owner')}
								onchange={() => toggleRole('owner')}
								disabled={isSubmitting}
								class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
							/>
							<span class="text-sm">
								<span class="font-medium">Owner</span> - Full system access including owner
								management
							</span>
						</label>
					{/if}
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							checked={roles.has('admin')}
							onchange={() => toggleRole('admin')}
							disabled={isSubmitting}
							class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
						/>
						<span class="text-sm">
							<span class="font-medium">Admin</span> - Member and role management
						</span>
					</label>
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							checked={roles.has('librarian')}
							onchange={() => toggleRole('librarian')}
							disabled={isSubmitting}
							class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
						/>
						<span class="text-sm">
							<span class="font-medium">Librarian</span> - Score management (upload, delete)
						</span>
					</label>
				</div>
				<p class="mt-2 text-sm text-gray-500">
					All members can view and download scores regardless of assigned roles.
				</p>
			</fieldset>

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
				An email with a magic link will be sent to the invitee. The link expires in 48 hours.
			</p>
		</div>
	</div>
</div>
