<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import type { Voice, Section } from '$lib/types';

	let { data }: { data: PageData } = $props();

	// Local state for settings form
	let settings = $state(untrack(() => data.settings));
	let voices = $state<Voice[]>(untrack(() => data.voices));
	let sections = $state<Section[]>(untrack(() => data.sections));
	let saving = $state(false);
	let togglingId = $state<string | null>(null);
	let error = $state('');
	let success = $state('');

	// Watch for data changes (e.g., on navigation)
	$effect(() => {
		settings = data.settings;
		voices = data.voices;
		sections = data.sections;
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

	async function toggleVoice(voice: Voice) {
		togglingId = voice.id;
		error = '';

		try {
			const response = await fetch(`/api/voices/${voice.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isActive: !voice.isActive })
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to update voice');
			}

			// Update local state
			voices = voices.map((v) => (v.id === voice.id ? { ...v, isActive: !v.isActive } : v));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update voice';
			setTimeout(() => (error = ''), 5000);
		} finally {
			togglingId = null;
		}
	}

	async function toggleSection(section: Section) {
		togglingId = section.id;
		error = '';

		try {
			const response = await fetch(`/api/sections/${section.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isActive: !section.isActive })
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to update section');
			}

			// Update local state
			sections = sections.map((s) => (s.id === section.id ? { ...s, isActive: !s.isActive } : s));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update section';
			setTimeout(() => (error = ''), 5000);
		} finally {
			togglingId = null;
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

	<!-- Voices Management -->
	<div class="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-xl font-semibold">Vocal Ranges</h2>
		<p class="mb-4 text-sm text-gray-600">
			Enable or disable vocal ranges available for member assignment. 
			Active ranges will appear in member profiles and invite forms.
		</p>
		
		<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{#each voices as voice (voice.id)}
				<button
					onclick={() => toggleVoice(voice)}
					disabled={togglingId === voice.id}
					class="flex items-center justify-between rounded-lg border px-4 py-3 text-left transition
						{voice.isActive 
							? 'border-purple-200 bg-purple-50 hover:bg-purple-100' 
							: 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}
						disabled:opacity-50"
				>
					<div>
						<span class="font-medium">{voice.name}</span>
						<span class="ml-2 text-sm text-gray-500">({voice.abbreviation})</span>
					</div>
					<div class="ml-2 text-sm">
						{#if togglingId === voice.id}
							<span class="text-gray-400">...</span>
						{:else if voice.isActive}
							<span class="text-green-600">✓</span>
						{:else}
							<span class="text-gray-400">○</span>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	</div>

	<!-- Sections Management -->
	<div class="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-xl font-semibold">Performance Sections</h2>
		<p class="mb-4 text-sm text-gray-600">
			Enable or disable sections for performance assignments. 
			Active sections will appear in member profiles and invite forms.
		</p>
		
		<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{#each sections as section (section.id)}
				<button
					onclick={() => toggleSection(section)}
					disabled={togglingId === section.id}
					class="flex items-center justify-between rounded-lg border px-4 py-3 text-left transition
						{section.isActive 
							? 'border-teal-200 bg-teal-50 hover:bg-teal-100' 
							: 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}
						disabled:opacity-50"
				>
					<div>
						<span class="font-medium">{section.name}</span>
						<span class="ml-2 text-sm text-gray-500">({section.abbreviation})</span>
					</div>
					<div class="ml-2 text-sm">
						{#if togglingId === section.id}
							<span class="text-gray-400">...</span>
						{:else if section.isActive}
							<span class="text-green-600">✓</span>
						{:else}
							<span class="text-gray-400">○</span>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	</div>
</div>
