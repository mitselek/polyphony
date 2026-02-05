<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import * as m from '$lib/paraglide/messages.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Form state
	let name = $state('');
	let email = $state(data.email);
	let subdomain = $state('');
	let subdomainStatus = $state<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved'>('idle');
	let subdomainError = $state('');
	let isSubmitting = $state(false);

	// Debounce timer for subdomain check
	let checkTimer: ReturnType<typeof setTimeout> | null = null;

	// Format subdomain as user types
	function formatSubdomain(value: string): string {
		return value
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, '')  // Remove invalid chars
			.replace(/--+/g, '-');        // No double hyphens
	}

	// Check subdomain availability
	async function checkSubdomain(value: string) {
		if (value.length < 3) {
			subdomainStatus = 'idle';
			subdomainError = '';
			return;
		}

		subdomainStatus = 'checking';
		subdomainError = '';

		try {
			const response = await fetch(`/api/subdomains/check?name=${encodeURIComponent(value)}`);
			const result = await response.json() as { available?: boolean; reason?: string; error?: string };

			if (!response.ok) {
				subdomainStatus = 'invalid';
				subdomainError = result.error || 'Invalid subdomain';
				return;
			}

			if (result.available) {
				subdomainStatus = 'available';
				subdomainError = '';
			} else {
				subdomainStatus = result.reason === 'reserved' ? 'reserved' : 'taken';
				subdomainError = result.reason === 'reserved' 
					? m["register.subdomain_reserved"]() 
					: m["register.subdomain_taken"]();
			}
		} catch {
			subdomainStatus = 'invalid';
			subdomainError = 'Failed to check availability';
		}
	}

	// Handle subdomain input
	function handleSubdomainInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const formatted = formatSubdomain(target.value);
		subdomain = formatted;
		target.value = formatted;

		// Clear previous timer
		if (checkTimer) {
			clearTimeout(checkTimer);
		}

		// Debounce the check
		if (formatted.length >= 3) {
			checkTimer = setTimeout(() => checkSubdomain(formatted), 500);
		} else {
			subdomainStatus = 'idle';
		}
	}

	// Form validation
	let isFormValid = $derived(
		name.trim().length > 0 &&
		email.trim().length > 0 &&
		subdomain.length >= 3 &&
		subdomainStatus === 'available'
	);

	// Status indicator classes
	function getStatusClass(status: typeof subdomainStatus): string {
		switch (status) {
			case 'checking': return 'text-gray-500';
			case 'available': return 'text-green-600';
			case 'taken':
			case 'reserved':
			case 'invalid': return 'text-red-600';
			default: return 'text-gray-400';
		}
	}

	function getStatusIcon(status: typeof subdomainStatus): string {
		switch (status) {
			case 'checking': return '⏳';
			case 'available': return '✓';
			case 'taken':
			case 'reserved':
			case 'invalid': return '✗';
			default: return '';
		}
	}
</script>

<svelte:head>
	<title>{m["register.title"]()} | Polyphony</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
	<div class="max-w-md w-full">
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-gray-900">{m["register.title"]()}</h1>
			<p class="mt-2 text-gray-600">{m["register.subtitle"]()}</p>
		</div>

		<div class="bg-white rounded-xl shadow-sm p-8">
			{#if form?.error}
				<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
					{form.error}
				</div>
			{/if}

			<form method="POST" class="space-y-6">
				<!-- Organization Name -->
				<div>
					<label for="name" class="block text-sm font-medium text-gray-700 mb-1">
						{m["register.org_name"]()}
					</label>
					<input
						type="text"
						id="name"
						name="name"
						bind:value={name}
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder={m["register.org_name_placeholder"]()}
					/>
				</div>

				<!-- Contact Email -->
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700 mb-1">
						{m["register.contact_email"]()}
					</label>
					<input
						type="email"
						id="email"
						name="email"
						bind:value={email}
						required
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
					/>
					<p class="mt-1 text-sm text-gray-500">{m["register.email_hint"]()}</p>
				</div>

				<!-- Subdomain -->
				<div>
					<label for="subdomain" class="block text-sm font-medium text-gray-700 mb-1">
						{m["register.subdomain"]()}
					</label>
					<div class="flex items-center">
						<input
							type="text"
							id="subdomain"
							name="subdomain"
							value={subdomain}
							oninput={handleSubdomainInput}
							required
							minlength="3"
							maxlength="30"
							pattern="[a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9]"
							class="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							placeholder={m["register.subdomain_placeholder"]()}
						/>
						<span class="px-4 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
							.polyphony.uk
						</span>
					</div>
					<div class="mt-1 flex items-center gap-2">
						{#if subdomainStatus !== 'idle'}
							<span class={getStatusClass(subdomainStatus)}>
								{getStatusIcon(subdomainStatus)}
								{#if subdomainStatus === 'checking'}
									{m["register.checking"]()}
								{:else if subdomainStatus === 'available'}
									{m["register.subdomain_available"]()}
								{:else}
									{subdomainError}
								{/if}
							</span>
						{:else if subdomain.length > 0 && subdomain.length < 3}
							<span class="text-gray-500 text-sm">{m["register.subdomain_too_short"]()}</span>
						{/if}
					</div>
				</div>

				<!-- Submit Button -->
				<button
					type="submit"
					disabled={!isFormValid || isSubmitting}
					class="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
				>
					{#if isSubmitting}
						{m["register.submitting"]()}
					{:else}
						{m["register.submit"]()}
					{/if}
				</button>
			</form>
		</div>

		<p class="mt-6 text-center text-sm text-gray-500">
			{m["register.note"]()}
		</p>
	</div>
</div>
