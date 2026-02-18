<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { MemberPreferences } from '$lib/types';
	import type { ResolvedI18nPreferences, PreferenceSource } from '$lib/server/i18n/preferences';
	import { ASSIGNABLE_ROLES } from '$lib/types';
	import EditionFileActions from '$lib/components/EditionFileActions.svelte';
	import Card from '$lib/components/Card.svelte';
	import InviteLinkCard from '$lib/components/InviteLinkCard.svelte';
	import { VoiceBadge, SectionBadge } from '$lib/components/badges';
	import { getRoleBadgeClass } from '$lib/utils/badges';
	import { toast } from '$lib/stores/toast';
	import * as m from '$lib/paraglide/messages.js';

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

	// i18n preferences state (only for own profile)
	let memberPrefs = $state(untrack(() => data.memberPrefs as MemberPreferences | null));
	let resolvedPrefs = $state(untrack(() => data.resolvedPrefs as ResolvedI18nPreferences | null));
	let savingPrefs = $state(false);

	// Local form values (initialized from memberPrefs or empty for 'use default')
	let prefLanguage = $state(untrack(() => memberPrefs?.language ?? ''));
	let prefLocale = $state(untrack(() => memberPrefs?.locale ?? ''));
	let prefTimezone = $state(untrack(() => memberPrefs?.timezone ?? ''));

	// Watch for data changes and update local state
	$effect(() => {
		member = data.member;
		memberPrefs = data.memberPrefs as MemberPreferences | null;
		resolvedPrefs = data.resolvedPrefs as ResolvedI18nPreferences | null;
		prefLanguage = (data.memberPrefs as MemberPreferences | null)?.language ?? '';
		prefLocale = (data.memberPrefs as MemberPreferences | null)?.locale ?? '';
		prefTimezone = (data.memberPrefs as MemberPreferences | null)?.timezone ?? '';
	});

	// Permission helpers: can edit name/nickname if admin OR own profile
	const canEditProfile = $derived(data.isAdmin || data.isOwnProfile);

	function startEditingName() {
		if (!canEditProfile) return;
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
				throw new Error(data.error ?? m.members_error_update_name());
			}

			// Update local state
			member = { ...member, name: trimmedName };
			isEditingName = false;
			toast.success(m.members_toast_name_updated());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.members_error_update_name());
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
		if (!canEditProfile) return;
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
				throw new Error(data.error ?? m.members_error_update_nickname());
			}

			// Update local state
			member = { ...member, nickname: trimmedNickname || null };
			isEditingNickname = false;
			toast.success(trimmedNickname ? m.members_toast_nickname_updated() : m.members_toast_nickname_cleared());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.members_error_update_nickname());
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
			toast.error(m.members_cannot_remove_last_owner());
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
				throw new Error(data.message ?? m.members_error_update_role());
			}

			// Update local state
			member = {
				...member,
				roles: action === 'add'
					? [...member.roles, role]
					: member.roles.filter((r) => r !== role)
			};
			toast.success(action === 'add' ? m.members_toast_role_added() : m.members_toast_role_removed());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.members_error_update_role());
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
				throw new Error(respData.message ?? m.members_error_add_voice());
			}

			const voice = data.availableVoices.find((v) => v.id === voiceId);
			if (voice) {
				member = {
					...member,
					voices: isPrimary ? [voice, ...member.voices] : [...member.voices, voice]
				};
			}
			toast.success(m.members_toast_voice_added());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.members_error_add_voice());
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
				throw new Error(respData.message ?? m.members_error_remove_voice());
			}

			member = {
				...member,
				voices: member.voices.filter((v) => v.id !== voiceId)
			};
			toast.success(m.members_toast_voice_removed());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.members_error_remove_voice());
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
				throw new Error(respData.message ?? m.members_error_add_section());
			}

			const section = data.availableSections.find((s) => s.id === sectionId);
			if (section) {
				member = {
					...member,
					sections: isPrimary ? [section, ...member.sections] : [...member.sections, section]
				};
			}
			toast.success(m.members_toast_section_added());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.members_error_add_section());
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
				throw new Error(respData.message ?? m.members_error_remove_section());
			}

			member = {
				...member,
				sections: member.sections.filter((s) => s.id !== sectionId)
			};
			toast.success(m.members_toast_section_removed());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.members_error_remove_section());
		} finally {
			updating = false;
		}
	}

	async function removeMember() {
		const confirmed = confirm(m.members_confirm_remove({ memberName: member.name }));

		if (!confirmed) return;

		updating = true;

		try {
			const response = await fetch(`/api/members/${member.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const respData = (await response.json()) as { message?: string };
				throw new Error(respData.message ?? m.members_error_remove_member());
			}

			// Navigate back to members list
			goto('/members');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.members_error_remove_member());
			updating = false;
		}
	}

	// i18n preferences functions
	function getEffectiveLabel(source: PreferenceSource | undefined): string {
		if (!source) return '';
		switch (source) {
			case 'member': return m.member_preference_source_own();
			case 'organization': return m.member_preference_source_org();
			case 'system': return m.member_preference_source_system();
		}
	}

	async function savePreferences() {
		savingPrefs = true;
		try {
			const response = await fetch('/api/profile/preferences', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					language: prefLanguage || null,
					locale: prefLocale || null,
					timezone: prefTimezone || null
				})
			});

			if (!response.ok) {
				const errData = await response.json() as { message?: string };
				throw new Error(errData.message ?? m.members_error_save_preferences());
			}

			memberPrefs = await response.json() as MemberPreferences;
			toast.success(m.members_toast_preferences_saved());
		} catch (err) {
			toast.error(err instanceof Error ? err.message : m.members_error_save_preferences());
		} finally {
			savingPrefs = false;
		}
	}
</script>

<svelte:head>
	<title>{data.isOwnProfile ? m.member_profile_title() : member.name} | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
	<!-- Back link -->
	<a
		href="/members"
		class="mb-6 inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline"
	>
		{m.member_back_link()}
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
		{:else if canEditProfile}
			<button
				type="button"
				onclick={startEditingName}
				class="text-3xl font-bold cursor-pointer hover:text-blue-600 text-left"
				title={m.member_edit_name_tooltip()}
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
				{m.members_remove_member()}
			</button>
		{/if}
	</div>

	<!-- Nickname (editable by admin or self) -->
	<div class="mb-6 -mt-4">
		{#if isEditingNickname}
			<div class="flex items-center gap-2">
				<span class="text-sm text-gray-500">{m.member_nickname_label()}</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					bind:value={editedNickname}
					onblur={saveNickname}
					onkeydown={handleNicknameKeydown}
					disabled={updating}
					placeholder={m.member_nickname_placeholder()}
					class="text-lg border-b-2 border-blue-500 bg-transparent outline-none px-1 py-0.5"
					autofocus
				/>
			</div>
		{:else if canEditProfile}
			<button
				type="button"
				onclick={startEditingNickname}
				class="text-gray-500 hover:text-blue-600 cursor-pointer text-sm"
				title={m.member_edit_name_tooltip()}
			>
				{#if member.nickname}
					<span class="text-gray-500">{m.member_nickname_label()}</span> <span class="text-gray-700">{member.nickname}</span>
				{:else}
					<span class="italic">{m.member_add_nickname()}</span>
				{/if}
			</button>
		{:else if member.nickname}
			<p class="text-sm text-gray-500">{m.member_nickname_label()} <span class="text-gray-700">{member.nickname}</span></p>
		{/if}
	</div>

	<Card padding="lg">
		<!-- Registration Status -->
		{#if !member.email_id}
			<div class="mb-6">
				{#if data.pendingInviteLink}
					<!-- Show copy link for pending invite -->
					<InviteLinkCard 
						inviteLink={data.pendingInviteLink}
						memberName={member.name}
						variant="info"
					/>
				{:else}
					<!-- No pending invite -->
					<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
						<div class="flex items-center justify-between">
							<div>
								<span class="font-medium text-amber-800">{m.member_roster_only_status()}</span>
								<p class="mt-1 text-sm text-amber-700">
									{m.member_roster_only_desc()}
								</p>
							</div>
							{#if data.isAdmin}
								<a
									href="/invite?rosterId={member.id}"
									class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
								>
									{m.member_send_invite_btn()}
								</a>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Roles -->
		<div class="mb-6">
			<h2 class="mb-2 text-sm font-medium text-gray-700">{m.member_roles_section()}</h2>
			{#if data.isAdmin}
				<!-- Editable roles for admins -->
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
								? m.member_roles_help_self()
								: isDisabled && !data.isOwner && role === 'owner'
									? m.member_roles_help_admin()
									: hasRole
										? m.member_remove_role({ role })
										: m.member_add_role({ role })}
						>
							{#if hasRole}
								✓ {role}
							{:else}
								+ {role}
							{/if}
						</button>
					{/each}
				</div>
				{#if !member.email_id && member.roles.length > 0}
					<p class="mt-1 text-xs text-amber-600">{m.member_roles_pending_registration()}</p>
				{/if}
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
				<span class="text-gray-500">{m.member_no_roles()}</span>
			{/if}
		</div>

		<!-- Voices -->
		<div class="mb-6">
			<h2 class="mb-2 text-sm font-medium text-gray-700">{m.member_voice_section()}</h2>
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
					<span class="text-gray-500">{m.member_no_voices()}</span>
				{/if}

				{#if data.isAdmin && !updating}
					<div class="relative">
						<button
							onclick={() => showingVoiceDropdown = !showingVoiceDropdown}
							class="text-purple-600 hover:text-purple-800 text-sm px-2 py-1 rounded hover:bg-purple-50"
						>
							{m.member_add_voice()}
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
										<div class="px-4 py-2 text-sm text-gray-500">{m.member_all_voices_assigned()}</div>
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
			<h2 class="mb-2 text-sm font-medium text-gray-700">{m.member_sections_section()}</h2>
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
					<span class="text-gray-500">{m.member_no_sections()}</span>
				{/if}

				{#if data.isAdmin && !updating}
					<div class="relative">
						<button
							onclick={() => showingSectionDropdown = !showingSectionDropdown}
							class="text-teal-600 hover:text-teal-800 text-sm px-2 py-1 rounded hover:bg-teal-50"
						>
							{m.member_add_section()}
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
										<div class="px-4 py-2 text-sm text-gray-500">{m.member_all_sections_assigned()}</div>
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
			<h2 class="mb-2 text-sm font-medium text-gray-700">{m.member_since_label()}</h2>
			<span class="text-gray-900">{new Date(member.joined_at).toLocaleDateString()}</span>
		</div>
	</Card>

	<!-- Language & Regional Preferences - Only for own profile -->
	{#if data.isOwnProfile && resolvedPrefs}
		<Card padding="lg" class="mt-6">
			<h2 class="mb-4 text-lg font-semibold">{m.member_preferences_title()}</h2>
			<p class="mb-6 text-sm text-gray-600">
				{m.member_preferences_desc()}
			</p>

			<form onsubmit={(e) => { e.preventDefault(); savePreferences(); }} class="space-y-6">
				<!-- Language -->
				<div>
					<label for="pref-language" class="block text-sm font-medium text-gray-700">
						{m.member_language_label()}
					</label>
					<select
						id="pref-language"
						bind:value={prefLanguage}
						class="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					>
						<option value="">{m.settings_use_org_default({ value: resolvedPrefs.language })}</option>
						<option value="en">{m.settings_lang_en()}</option>
						<option value="et">{m.settings_lang_et()}</option>
						<option value="lv">{m.settings_lang_lv()}</option>
						<option value="uk">{m.settings_lang_uk()}</option>
					</select>
					<p class="mt-1 text-xs text-gray-500">
						{m.member_preference_effective()} {resolvedPrefs.language} {getEffectiveLabel(resolvedPrefs.source.language)}
					</p>
				</div>

				<!-- Locale -->
				<div>
					<label for="pref-locale" class="block text-sm font-medium text-gray-700">
						{m.member_locale_label()}
					</label>
					<select
						id="pref-locale"
						bind:value={prefLocale}
						class="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					>
						<option value="">{m.settings_use_org_default({ value: resolvedPrefs.locale })}</option>
						<option value="en-US">{m.settings_locale_en_us()}</option>
						<option value="en-GB">{m.settings_locale_en_gb()}</option>
						<option value="et-EE">{m.settings_locale_et_ee()}</option>
						<option value="lv-LV">{m.settings_locale_lv_lv()}</option>
						<option value="uk-UA">{m.settings_locale_uk_ua()}</option>
					</select>
					<p class="mt-1 text-xs text-gray-500">
						{m.member_preference_effective()} {resolvedPrefs.locale} {getEffectiveLabel(resolvedPrefs.source.locale)}
					</p>
				</div>

				<!-- Timezone -->
				<div>
					<label for="pref-timezone" class="block text-sm font-medium text-gray-700">
						{m.member_timezone_label()}
					</label>
					<select
						id="pref-timezone"
						bind:value={prefTimezone}
						class="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					>
						<option value="">{m.settings_use_org_default({ value: resolvedPrefs.timezone })}</option>
						<option value="Europe/Tallinn">{m.settings_tz_tallinn()}</option>
						<option value="Europe/Helsinki">{m.settings_tz_helsinki()}</option>
						<option value="Europe/Riga">{m.settings_tz_riga()}</option>
						<option value="Europe/Vilnius">{m.settings_tz_vilnius()}</option>
						<option value="Europe/Stockholm">{m.settings_tz_stockholm()}</option>
						<option value="Europe/Berlin">{m.settings_tz_berlin()}</option>
						<option value="Europe/Amsterdam">{m.settings_tz_amsterdam()}</option>
						<option value="Europe/Paris">{m.settings_tz_paris()}</option>
						<option value="Europe/London">{m.settings_tz_london()}</option>
						<option value="Europe/Moscow">{m.settings_tz_moscow()}</option>
						<option value="America/New_York">{m.settings_tz_new_york()}</option>
						<option value="America/Chicago">{m.settings_tz_chicago()}</option>
						<option value="America/Los_Angeles">{m.settings_tz_los_angeles()}</option>
						<option value="UTC">{m.settings_tz_utc()}</option>
					</select>
					<p class="mt-1 text-xs text-gray-500">
						{m.member_preference_effective()} {resolvedPrefs.timezone} {getEffectiveLabel(resolvedPrefs.source.timezone)}
					</p>
				</div>

				<div class="flex justify-end">
					<button
						type="submit"
						disabled={savingPrefs}
						class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{savingPrefs ? m.settings_saving_btn() : m.member_preferences_save()}
					</button>
				</div>
			</form>
		</Card>
	{/if}

	<!-- My Scores Section - Only visible to profile owner or admins -->
	{#if data.assignedCopies}
		<Card padding="lg" class="mt-8">
			<h2 class="mb-4 text-xl font-semibold text-gray-900">
				{data.isOwnProfile ? m.member_scores_title_own() : m.member_scores_title_other()}
			</h2>

			{#if data.assignedCopies.length === 0}
				<p class="text-gray-500">
					{data.isOwnProfile
						? m.member_no_scores_own()
						: m.member_no_scores_other()}
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
										{copy.edition.name} · {m.members_copy_number({ number: copy.copyNumber })}
									</p>
									<p class="mt-1 text-xs text-gray-400">
										{m.member_score_assigned_date({ date: new Date(copy.assignedAt).toLocaleDateString() })}{#if data.org && copy.org.subdomain !== data.org.subdomain}
											{' '}{m.member_score_by_org({ name: copy.org.name })}{/if}
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