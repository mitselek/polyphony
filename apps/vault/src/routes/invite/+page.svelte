<script lang="ts">
	import { goto } from '$app/navigation';

	let email = $state('');
	let role = $state<'singer' | 'librarian' | 'admin'>('singer');
	let isSubmitting = $state(false);
	let error = $state('');
	let success = $state('');

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!email) {
			error = 'Email is required';
			return;
		}

		isSubmitting = true;
		error = '';
		success = '';

		try {
			// TODO: Get member_id from session
			const response = await fetch('/api/members/invite', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Member-Id': 'admin-placeholder' // TODO: Real auth
				},
				body: JSON.stringify({ email, role })
			});

			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to send invite');
			}

			success = `Invitation sent to ${email}!`;
			email = '';
			role = 'singer';
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

			<div>
				<label for="role" class="mb-1 block text-sm font-medium text-gray-700">
					Role
				</label>
				<select
					id="role"
					bind:value={role}
					disabled={isSubmitting}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100"
				>
					<option value="singer">Singer</option>
					<option value="librarian">Librarian</option>
					<option value="admin">Admin</option>
				</select>
				<p class="mt-1 text-sm text-gray-500">
					{#if role === 'singer'}
						Can view and download scores
					{:else if role === 'librarian'}
						Can manage scores and view members
					{:else}
						Full access including member management
					{/if}
				</p>
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
