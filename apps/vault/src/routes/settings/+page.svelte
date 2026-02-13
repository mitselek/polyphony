<script lang="ts">
  import { untrack } from "svelte";
  import type { PageData } from "./$types";
  import type { Organization } from "$lib/types";
  import Card from "$lib/components/Card.svelte";
  import SettingsEntityCard from "$lib/components/settings/SettingsEntityCard.svelte";
  import { DEFAULT_EVENT_DURATION_MINUTES } from "$lib/utils/formatters";
  import { toast } from "$lib/stores/toast";

  let { data }: { data: PageData } = $props();

  // Local state for settings form
  let settings = $state(untrack(() => data.settings));
  let voices = $state(untrack(() => data.voices));
  let sections = $state(untrack(() => data.sections));
  let organization = $state(untrack(() => data.organization as Organization));
  let saving = $state(false);
  let savingOrg = $state(false);

  // Watch for data changes (e.g., on navigation)
  $effect(() => {
    settings = data.settings;
    voices = data.voices;
    sections = data.sections;
    organization = data.organization as Organization;
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    saving = true;

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_event_duration: parseInt(settings.default_event_duration) || DEFAULT_EVENT_DURATION_MINUTES,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message ?? "Failed to save settings");
      }

      const updated = (await response.json()) as Record<string, string>;
      settings = updated;
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      saving = false;
    }
  }

  async function handleOrgSubmit(e: Event) {
    e.preventDefault();
    savingOrg = true;

    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: organization.language || null,
          locale: organization.locale || null,
          timezone: organization.timezone || null,
          trustIndividualResponsibility: organization.trustIndividualResponsibility,
        }),
      });

      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message ?? "Failed to save organization settings");
      }

      const updated = (await response.json()) as Organization;
      organization = updated;
      toast.success("Organization settings saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save organization settings");
    } finally {
      savingOrg = false;
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

  <Card padding="lg">
    <form onsubmit={handleSubmit} class="space-y-6">
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
        <p class="mt-1 text-sm text-gray-500">Default duration for new events (15-480 minutes)</p>
      </div>

      <!-- Submit Button -->
      <div class="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </form>
  </Card>

  <!-- Organization Settings -->
  <Card padding="lg" class="mt-6">
    <h2 class="mb-4 text-lg font-semibold">Organization Settings</h2>
    <p class="mb-6 text-sm text-gray-600">
      Default language, locale, and timezone for all members. Members can override these in their personal settings.
    </p>
    <form onsubmit={handleOrgSubmit} class="space-y-6">
      <!-- Trust Individual Responsibility (Issue #240) -->
      <div class="flex items-center justify-between rounded-lg border border-gray-200 p-4">
        <div>
          <label for="trust-individual-responsibility" class="block text-sm font-medium text-gray-700">
            Trust Individual Responsibility
          </label>
          <p class="mt-1 text-sm text-gray-500">
            Allow members to manage their own RSVP and attendance records for past and future events.
            When disabled, only administrators and conductors can modify attendance.
          </p>
        </div>
        <button
          id="trust-individual-responsibility"
          type="button"
          role="switch"
          aria-checked={organization.trustIndividualResponsibility}
          aria-label="Trust Individual Responsibility"
          onclick={() => (organization.trustIndividualResponsibility = !organization.trustIndividualResponsibility)}
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 {organization.trustIndividualResponsibility ? 'bg-blue-600' : 'bg-gray-200'}"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {organization.trustIndividualResponsibility ? 'translate-x-5' : 'translate-x-0'}"
          ></span>
        </button>
      </div>

      <!-- Language Setting -->
      <div>
        <label for="org-language" class="block text-sm font-medium text-gray-700">
          Language
        </label>
        <select
          id="org-language"
          bind:value={organization.language}
          class="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">System default (English)</option>
          <option value="en">English</option>
          <option value="et">Estonian</option>
          <option value="lv">Latvian</option>
          <option value="uk">Ukrainian</option>
        </select>
        <p class="mt-1 text-sm text-gray-500">
          UI language for the organization (ISO 639-1)
        </p>
      </div>

      <!-- Locale Setting -->
      <div>
        <label for="org-locale" class="block text-sm font-medium text-gray-700">
          Date & Number Format
        </label>
        <select
          id="org-locale"
          bind:value={organization.locale}
          class="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">System default (en-US)</option>
          <option value="en-US">English US (en-US)</option>
          <option value="en-GB">English UK (en-GB)</option>
          <option value="et-EE">Estonian (et-EE)</option>
          <option value="lv-LV">Latvian (lv-LV)</option>
          <option value="uk-UA">Ukrainian (uk-UA)</option>
        </select>
        <p class="mt-1 text-sm text-gray-500">
          Format for dates, times, and numbers (BCP 47)
        </p>
      </div>

      <!-- Timezone Setting -->
      <div>
        <label for="org-timezone" class="block text-sm font-medium text-gray-700">
          Timezone
        </label>
        <select
          id="org-timezone"
          bind:value={organization.timezone}
          class="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">System default (UTC)</option>
          <option value="Europe/Tallinn">Tallinn (EET/EEST)</option>
          <option value="Europe/Helsinki">Helsinki (EET/EEST)</option>
          <option value="Europe/Riga">Riga (EET/EEST)</option>
          <option value="Europe/Vilnius">Vilnius (EET/EEST)</option>
          <option value="Europe/Stockholm">Stockholm (CET/CEST)</option>
          <option value="Europe/Berlin">Berlin (CET/CEST)</option>
          <option value="Europe/Amsterdam">Amsterdam (CET/CEST)</option>
          <option value="Europe/Paris">Paris (CET/CEST)</option>
          <option value="Europe/London">London (GMT/BST)</option>
          <option value="Europe/Moscow">Moscow (MSK)</option>
          <option value="America/New_York">New York (EST/EDT)</option>
          <option value="America/Chicago">Chicago (CST/CDT)</option>
          <option value="America/Los_Angeles">Los Angeles (PST/PDT)</option>
          <option value="UTC">UTC</option>
        </select>
        <p class="mt-1 text-sm text-gray-500">
          Timezone for events and schedules (IANA)
        </p>
      </div>

      <!-- Submit Button -->
      <div class="flex justify-end">
        <button
          type="submit"
          disabled={savingOrg}
          class="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingOrg ? "Saving..." : "Save Organization Settings"}
        </button>
      </div>
    </form>
  </Card>

  <!-- Voices Management -->
  <SettingsEntityCard type="voice" bind:items={voices} orgId={organization.id} />

  <!-- Sections Management -->
  <SettingsEntityCard type="section" bind:items={sections} orgId={organization.id} />
</div>
