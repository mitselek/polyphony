<script lang="ts">
  import { untrack } from "svelte";
  import type { PageData } from "./$types";
  import type { VoiceWithCount } from "$lib/server/db/voices";
  import type { SectionWithCount } from "$lib/server/db/sections";
  import Card from "$lib/components/Card.svelte";
  import SettingsVoicesCard from "$lib/components/settings/SettingsVoicesCard.svelte";
  import SettingsSectionsCard from "$lib/components/settings/SettingsSectionsCard.svelte";

  let { data }: { data: PageData } = $props();

  // Local state for settings form
  let settings = $state(untrack(() => data.settings));
  let voices = $state<VoiceWithCount[]>(untrack(() => data.voices));
  let sections = $state<SectionWithCount[]>(untrack(() => data.sections));
  let saving = $state(false);
  let error = $state("");
  let success = $state("");

  // Watch for data changes (e.g., on navigation)
  $effect(() => {
    settings = data.settings;
    voices = data.voices;
    sections = data.sections;
  });

  function handleSuccess(message: string) {
    success = message;
    setTimeout(() => (success = ""), 3000);
  }

  function handleError(message: string) {
    error = message;
    setTimeout(() => (error = ""), 5000);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    saving = true;
    error = "";
    success = "";

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_event_duration: parseInt(settings.default_event_duration) || 120,
          locale: settings.locale || "system",
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message ?? "Failed to save settings");
      }

      const updated = (await response.json()) as Record<string, string>;
      settings = updated;
      handleSuccess("Settings saved successfully");
    } catch (err) {
      handleError(err instanceof Error ? err.message : "Failed to save settings");
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

  <Card padding="lg">
    <form onsubmit={handleSubmit} class="space-y-6">
      <!-- Locale Setting -->
      <div>
        <label for="locale" class="block text-sm font-medium text-gray-700">
          Date & Time Format
        </label>
        <select
          id="locale"
          bind:value={settings.locale}
          class="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="system">System (browser default)</option>
          <option value="et-EE">Estonian (et-EE)</option>
          <option value="en-US">English US (en-US)</option>
          <option value="en-GB">English UK (en-GB)</option>
          <option value="de-DE">German (de-DE)</option>
          <option value="fi-FI">Finnish (fi-FI)</option>
          <option value="sv-SE">Swedish (sv-SE)</option>
          <option value="lv-LV">Latvian (lv-LV)</option>
          <option value="lt-LT">Lithuanian (lt-LT)</option>
          <option value="ru-RU">Russian (ru-RU)</option>
          <option value="fr-FR">French (fr-FR)</option>
          <option value="nl-NL">Dutch (nl-NL)</option>
        </select>
        <p class="mt-1 text-sm text-gray-500">
          Format for displaying dates and times throughout the vault
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

  <!-- Voices Management -->
  <SettingsVoicesCard bind:voices onSuccess={handleSuccess} onError={handleError} />

  <!-- Sections Management -->
  <SettingsSectionsCard bind:sections onSuccess={handleSuccess} onError={handleError} />
</div>
