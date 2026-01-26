<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Local state for settings form
	let settings = $state(untrack(() => data.settings));
	let saving = $state(false);
	let error = $state('');
	let success = $state('');

	// Watch for data changes (e.g., on navigation)
	$effect(() => {
		settings = data.settings;
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		saving = true;
		error = '';
		success = '';

		try {
			const response = await fetch('/api/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					default_voice_part: settings.default_voice_part || '',
					default_event_duration: parseInt(settings.default_event_duration) || 120
				})
			});

			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Failed to save settings');
			}

			const updated = (await response.json()) as Record<string, string>;
			settings = updated;
			success = 'Settings saved successfully';
			setTimeout(() => (success = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save settings';
			setTimeout(() => (error = ''), 5000);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Vault Settings | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold">Vault Settings</h1>
		<p class="mt-2 text-gray-600">Configure default settings for your choir</p>
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

	<form onsubmit={handleSubmit} class="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<!-- Default Voice Part -->
		<div>
			<label for="default_voice_part" class="block text-sm font-medium text-gray-700">
				Default Voice Part
			</label>
			<select
				id="default_voice_part"
				bind:value={settings.default_voice_part}
				class="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
			<p class="mt-1 text-sm text-gray-500">
				Default voice part for new members
			</p>
		</div>

		<!-- Default Event Duration -->
		<div>
			<label for="default_event_duration" class="block text-sm font-medium text-gray-700">
				Default Event Duration (minutes)
			</label>
			<input
				type="number"
				id="default_event_duration"
				bind:value={settings.default_event_duration}
				min="15"
				max="480"
				step="15"
				class="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			/>
			<p class="mt-1 text-sm text-gray-500">
				Default duration for new events (15-480 minutes)
			</p>
		</div>

		<!-- Submit Button -->
		<div class="flex justify-end">
			<button
				type="submit"
				disabled={saving}
				class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{saving ? 'Saving...' : 'Save Settings'}
			</button>
		</div>
	</form>
</div>
