<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const member = data.member;
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

	<h1 class="mb-8 text-3xl font-bold">{member.name}</h1>

	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<!-- Registration Status -->
		{#if !member.email_id}
			<div class="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
				<span class="font-medium text-amber-800">Roster-only member</span>
				<p class="mt-1 text-sm text-amber-700">
					This member has not yet completed OAuth registration.
				</p>
			</div>
		{/if}

		<!-- Roles -->
		<div class="mb-6">
			<h2 class="mb-2 text-sm font-medium text-gray-700">Roles</h2>
			{#if member.roles.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each member.roles as role}
						<span
							class="rounded-full px-3 py-1 text-sm font-medium
								{role === 'owner'
								? 'bg-purple-100 text-purple-800'
								: role === 'admin'
									? 'bg-blue-100 text-blue-800'
									: role === 'librarian'
										? 'bg-green-100 text-green-800'
										: role === 'conductor'
											? 'bg-amber-100 text-amber-800'
											: role === 'section_leader'
												? 'bg-teal-100 text-teal-800'
												: 'bg-gray-100 text-gray-800'}"
						>
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
			{#if member.voices.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each member.voices as voice, index}
						<span
							class="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800"
							title="{voice.name} {index === 0 ? '(primary)' : ''}"
						>
							{#if index === 0}★{/if}
							{voice.name} ({voice.abbreviation})
						</span>
					{/each}
				</div>
			{:else}
				<span class="text-gray-500">No voices assigned</span>
			{/if}
		</div>

		<!-- Sections -->
		<div class="mb-6">
			<h2 class="mb-2 text-sm font-medium text-gray-700">Sections</h2>
			{#if member.sections.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each member.sections as section, index}
						<span
							class="rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-800"
							title="{section.name} {index === 0 ? '(primary)' : ''}"
						>
							{#if index === 0}★{/if}
							{section.name} ({section.abbreviation})
						</span>
					{/each}
				</div>
			{:else}
				<span class="text-gray-500">No sections assigned</span>
			{/if}
		</div>

		<!-- Member Since -->
		<div>
			<h2 class="mb-2 text-sm font-medium text-gray-700">Member Since</h2>
			<span class="text-gray-900">{new Date(member.joined_at).toLocaleDateString()}</span>
		</div>
	</div>
</div>
