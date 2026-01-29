<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import type { VoiceWithCount } from '$lib/server/db/voices';
	import type { SectionWithCount } from '$lib/server/db/sections';

	let { data }: { data: PageData } = $props();

	// Local state for settings form
	let settings = $state(untrack(() => data.settings));
	let voices = $state<VoiceWithCount[]>(untrack(() => data.voices));
	let sections = $state<SectionWithCount[]>(untrack(() => data.sections));
	let saving = $state(false);
	let togglingId = $state<string | null>(null);
	let deletingId = $state<string | null>(null);
	let reassigningId = $state<string | null>(null);
	let creatingVoice = $state(false);
	let creatingSection = $state(false);
	let error = $state('');
	let success = $state('');
	
	// Dropdown state for reassignment
	let openReassignDropdown = $state<string | null>(null);
	
	// New voice/section form state
	let newVoiceName = $state('');
	let newVoiceAbbr = $state('');
	let newVoiceCategory = $state<'vocal' | 'instrumental'>('vocal');
	let newSectionName = $state('');
	let newSectionAbbr = $state('');

	// Watch for data changes (e.g., on navigation)
	$effect(() => {
		settings = data.settings;
		voices = data.voices;
		sections = data.sections;
	});
	
	// Close dropdown when clicking outside
	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.reassign-dropdown')) {
			openReassignDropdown = null;
		}
	}

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

	async function toggleVoice(voice: VoiceWithCount) {
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

	async function toggleSection(section: SectionWithCount) {
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
	
	async function deleteVoice(voice: VoiceWithCount) {
		if (voice.assignmentCount > 0) return; // Safety check
		
		if (!confirm(`Delete "${voice.name}"? This cannot be undone.`)) return;
		
		deletingId = voice.id;
		error = '';
		
		try {
			const response = await fetch(`/api/voices/${voice.id}`, { method: 'DELETE' });
			
			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to delete voice');
			}
			
			// Remove from local state
			voices = voices.filter((v) => v.id !== voice.id);
			success = `Deleted "${voice.name}"`;
			setTimeout(() => (success = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete voice';
			setTimeout(() => (error = ''), 5000);
		} finally {
			deletingId = null;
		}
	}
	
	async function deleteSection(section: SectionWithCount) {
		if (section.assignmentCount > 0) return; // Safety check
		
		if (!confirm(`Delete "${section.name}"? This cannot be undone.`)) return;
		
		deletingId = section.id;
		error = '';
		
		try {
			const response = await fetch(`/api/sections/${section.id}`, { method: 'DELETE' });
			
			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to delete section');
			}
			
			// Remove from local state
			sections = sections.filter((s) => s.id !== section.id);
			success = `Deleted "${section.name}"`;
			setTimeout(() => (success = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete section';
			setTimeout(() => (error = ''), 5000);
		} finally {
			deletingId = null;
		}
	}
	
	async function reassignVoice(sourceId: string, targetId: string) {
		openReassignDropdown = null;
		reassigningId = sourceId;
		error = '';
		
		try {
			const response = await fetch(`/api/voices/${sourceId}/reassign`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetVoiceId: targetId })
			});
			
			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to reassign voice');
			}
			
			const result = (await response.json()) as { movedCount: number; sourceVoice: string; targetVoice: string };
			
			// Update local state - source count goes to 0, target count increases
			voices = voices.map((v) => {
				if (v.id === sourceId) return { ...v, assignmentCount: 0 };
				if (v.id === targetId) {
					const sourceVoice = voices.find((x) => x.id === sourceId);
					return { ...v, assignmentCount: v.assignmentCount + (sourceVoice?.assignmentCount ?? 0) };
				}
				return v;
			});
			
			success = `Moved ${result.movedCount} assignment(s) from ${result.sourceVoice} to ${result.targetVoice}`;
			setTimeout(() => (success = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to reassign voice';
			setTimeout(() => (error = ''), 5000);
		} finally {
			reassigningId = null;
		}
	}
	
	async function reassignSection(sourceId: string, targetId: string) {
		openReassignDropdown = null;
		reassigningId = sourceId;
		error = '';
		
		try {
			const response = await fetch(`/api/sections/${sourceId}/reassign`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetSectionId: targetId })
			});
			
			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to reassign section');
			}
			
			const result = (await response.json()) as { movedCount: number; sourceSection: string; targetSection: string };
			
			// Update local state - source count goes to 0, target count increases
			sections = sections.map((s) => {
				if (s.id === sourceId) return { ...s, assignmentCount: 0 };
				if (s.id === targetId) {
					const sourceSection = sections.find((x) => x.id === sourceId);
					return { ...s, assignmentCount: s.assignmentCount + (sourceSection?.assignmentCount ?? 0) };
				}
				return s;
			});
			
			success = `Moved ${result.movedCount} assignment(s) from ${result.sourceSection} to ${result.targetSection}`;
			setTimeout(() => (success = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to reassign section';
			setTimeout(() => (error = ''), 5000);
		} finally {
			reassigningId = null;
		}
	}
	
	async function createVoice(e: Event) {
		e.preventDefault();
		if (!newVoiceName.trim() || !newVoiceAbbr.trim()) return;
		
		creatingVoice = true;
		error = '';
		
		try {
			const response = await fetch('/api/voices', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newVoiceName.trim(),
					abbreviation: newVoiceAbbr.trim(),
					category: newVoiceCategory,
					displayOrder: voices.length
				})
			});
			
			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to create voice');
			}
			
			const newVoice = (await response.json()) as VoiceWithCount;
			// Add assignmentCount = 0 for new voice
			voices = [...voices, { ...newVoice, assignmentCount: 0 }];
			
			// Clear form
			newVoiceName = '';
			newVoiceAbbr = '';
			newVoiceCategory = 'vocal';
			
			success = `Created "${newVoice.name}"`;
			setTimeout(() => (success = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create voice';
			setTimeout(() => (error = ''), 5000);
		} finally {
			creatingVoice = false;
		}
	}
	
	async function createSection(e: Event) {
		e.preventDefault();
		if (!newSectionName.trim() || !newSectionAbbr.trim()) return;
		
		creatingSection = true;
		error = '';
		
		try {
			const response = await fetch('/api/sections', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newSectionName.trim(),
					abbreviation: newSectionAbbr.trim(),
					displayOrder: sections.length
				})
			});
			
			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? 'Failed to create section');
			}
			
			const newSection = (await response.json()) as SectionWithCount;
			// Add assignmentCount = 0 for new section
			sections = [...sections, { ...newSection, assignmentCount: 0 }];
			
			// Clear form
			newSectionName = '';
			newSectionAbbr = '';
			
			success = `Created "${newSection.name}"`;
			setTimeout(() => (success = ''), 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create section';
			setTimeout(() => (error = ''), 5000);
		} finally {
			creatingSection = false;
		}
	}
</script>

<svelte:head>
	<title>Vault Settings | Polyphony Vault</title>
</svelte:head>

<svelte:window onclick={handleClickOutside} />

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
			Manage vocal ranges for member assignment. Click left side to toggle active status, right side to delete or reassign.
		</p>
		
		<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{#each voices as voice (voice.id)}
				{@const isProcessing = togglingId === voice.id || deletingId === voice.id || reassigningId === voice.id}
				<div class="flex items-center rounded-lg border {voice.isActive ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50'}">
					<!-- Left side: Toggle active -->
					<button
						onclick={() => toggleVoice(voice)}
						disabled={isProcessing}
						class="flex flex-1 items-center justify-between px-3 py-2 text-left transition hover:bg-purple-100 disabled:opacity-50 rounded-l-lg"
					>
						<div class="flex items-center gap-1 min-w-0">
							<span class="font-medium truncate {voice.isActive ? '' : 'text-gray-500'}">{voice.name}</span>
							<span class="text-xs text-gray-500 shrink-0">({voice.abbreviation})</span>
							{#if voice.category === 'instrumental'}
								<span class="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">instr</span>
							{/if}
						</div>
						<span class="text-lg" title={voice.isActive ? 'Active' : 'Inactive'}>
							{#if togglingId === voice.id}
								<span class="text-gray-400">⏳</span>
							{:else if voice.isActive}
								<span class="text-green-600">🟢</span>
							{:else}
								<span class="text-gray-400">⚪</span>
							{/if}
						</span>
					</button>
					
					<!-- Right side: Delete or Reassign -->
					<div class="border-l border-gray-200 reassign-dropdown relative">
						{#if voice.assignmentCount === 0}
							<!-- No assignments: show delete button -->
							<button
								onclick={() => deleteVoice(voice)}
								disabled={isProcessing}
								class="px-2 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-r-lg transition"
								title="Delete (no assignments)"
							>
								{#if deletingId === voice.id}
									⏳
								{:else}
									🗑️
								{/if}
							</button>
						{:else}
							<!-- Has assignments: show reassign dropdown -->
							<button
								onclick={() => openReassignDropdown = openReassignDropdown === voice.id ? null : voice.id}
								disabled={isProcessing}
								class="px-2 py-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50 rounded-r-lg transition flex items-center gap-0.5"
								title="Reassign {voice.assignmentCount} member(s)"
							>
								{#if reassigningId === voice.id}
									⏳
								{:else}
									<span>↔️</span>
									<span class="text-sm font-medium">{voice.assignmentCount}</span>
									<span class="text-xs">▼</span>
								{/if}
							</button>
							
							{#if openReassignDropdown === voice.id}
								<div class="absolute right-0 top-full z-10 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
									<div class="py-1">
										<div class="px-3 py-2 text-xs text-gray-500 border-b">Reassign to:</div>
										{#each voices.filter((v) => v.id !== voice.id) as targetVoice}
											<button
												onclick={() => reassignVoice(voice.id, targetVoice.id)}
												class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
											>
												{targetVoice.name} ({targetVoice.abbreviation})
											</button>
										{/each}
									</div>
								</div>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		</div>
		
		<!-- Create new voice form -->
		<form onsubmit={createVoice} class="mt-4 border-t pt-4">
			<h3 class="text-sm font-medium text-gray-700 mb-2">Add New Vocal Range</h3>
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={newVoiceName}
					placeholder="Name (e.g., Mezzo-Soprano)"
					class="flex-1 rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
					required
				/>
				<input
					type="text"
					bind:value={newVoiceAbbr}
					placeholder="Abbr (e.g., MS)"
					class="w-24 rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
					maxlength="5"
					required
				/>
				<select
					bind:value={newVoiceCategory}
					class="rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
				>
					<option value="vocal">Vocal</option>
					<option value="instrumental">Instrumental</option>
				</select>
				<button
					type="submit"
					disabled={creatingVoice || !newVoiceName.trim() || !newVoiceAbbr.trim()}
					class="rounded-md bg-purple-600 px-4 py-2 text-sm text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{creatingVoice ? '...' : 'Add'}
				</button>
			</div>
		</form>
	</div>

	<!-- Sections Management -->
	<div class="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-xl font-semibold">Performance Sections</h2>
		<p class="mb-4 text-sm text-gray-600">
			Manage sections for performance assignments. Click left side to toggle active status, right side to delete or reassign.
		</p>
		
		<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{#each sections as section (section.id)}
				{@const isProcessing = togglingId === section.id || deletingId === section.id || reassigningId === section.id}
				<div class="flex items-center rounded-lg border {section.isActive ? 'border-teal-200 bg-teal-50' : 'border-gray-200 bg-gray-50'}">
					<!-- Left side: Toggle active -->
					<button
						onclick={() => toggleSection(section)}
						disabled={isProcessing}
						class="flex flex-1 items-center justify-between px-3 py-2 text-left transition hover:bg-teal-100 disabled:opacity-50 rounded-l-lg"
					>
						<div class="flex items-center gap-1 min-w-0">
							<span class="font-medium truncate {section.isActive ? '' : 'text-gray-500'}">{section.name}</span>
							<span class="text-xs text-gray-500 shrink-0">({section.abbreviation})</span>
						</div>
						<span class="text-lg" title={section.isActive ? 'Active' : 'Inactive'}>
							{#if togglingId === section.id}
								<span class="text-gray-400">⏳</span>
							{:else if section.isActive}
								<span class="text-green-600">🟢</span>
							{:else}
								<span class="text-gray-400">⚪</span>
							{/if}
						</span>
					</button>
					
					<!-- Right side: Delete or Reassign -->
					<div class="border-l border-gray-200 reassign-dropdown relative">
						{#if section.assignmentCount === 0}
							<!-- No assignments: show delete button -->
							<button
								onclick={() => deleteSection(section)}
								disabled={isProcessing}
								class="px-2 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-r-lg transition"
								title="Delete (no assignments)"
							>
								{#if deletingId === section.id}
									⏳
								{:else}
									🗑️
								{/if}
							</button>
						{:else}
							<!-- Has assignments: show reassign dropdown -->
							<button
								onclick={() => openReassignDropdown = openReassignDropdown === section.id ? null : section.id}
								disabled={isProcessing}
								class="px-2 py-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50 rounded-r-lg transition flex items-center gap-0.5"
								title="Reassign {section.assignmentCount} member(s)"
							>
								{#if reassigningId === section.id}
									⏳
								{:else}
									<span>↔️</span>
									<span class="text-sm font-medium">{section.assignmentCount}</span>
									<span class="text-xs">▼</span>
								{/if}
							</button>
							
							{#if openReassignDropdown === section.id}
								<div class="absolute right-0 top-full z-10 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
									<div class="py-1">
										<div class="px-3 py-2 text-xs text-gray-500 border-b">Reassign to:</div>
										{#each sections.filter((s) => s.id !== section.id) as targetSection}
											<button
												onclick={() => reassignSection(section.id, targetSection.id)}
												class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
											>
												{targetSection.name} ({targetSection.abbreviation})
											</button>
										{/each}
									</div>
								</div>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		</div>
		
		<!-- Create new section form -->
		<form onsubmit={createSection} class="mt-4 border-t pt-4">
			<h3 class="text-sm font-medium text-gray-700 mb-2">Add New Section</h3>
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={newSectionName}
					placeholder="Name (e.g., Soprano 3)"
					class="flex-1 rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
					required
				/>
				<input
					type="text"
					bind:value={newSectionAbbr}
					placeholder="Abbr (e.g., S3)"
					class="w-24 rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
					maxlength="5"
					required
				/>
				<button
					type="submit"
					disabled={creatingSection || !newSectionName.trim() || !newSectionAbbr.trim()}
					class="rounded-md bg-teal-600 px-4 py-2 text-sm text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{creatingSection ? '...' : 'Add'}
				</button>
			</div>
		</form>
	</div>
</div>
