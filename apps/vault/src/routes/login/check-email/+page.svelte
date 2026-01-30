<script lang="ts">
	import { page } from '$app/stores';
	import { REGISTRY_URL } from '$lib/config';

	const email = $derived($page.url.searchParams.get('email') || '');
	const inviteToken = $derived($page.url.searchParams.get('invite') || '');
	let code = $state('');
	let isVerifying = $state(false);

	function handleCodeInput(e: Event) {
		const input = e.target as HTMLInputElement;
		// Uppercase and filter to alphanumeric only
		code = input.value
			.toUpperCase()
			.replace(/[^A-Z0-9]/g, '')
			.slice(0, 6);
	}

	function verifyCode() {
		if (code.length !== 6 || isVerifying) return;

		isVerifying = true;

		// Redirect to registry verify endpoint
		// Registry will validate and redirect back to vault with JWT
		window.location.href = `${REGISTRY_URL}/auth/verify?code=${code}&email=${encodeURIComponent(email)}`;
	}

	async function resendCode() {
		// Go back to login to request a new code (preserve invite token)
		window.location.href = inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : '/login';
	}
</script>

<svelte:head>
	<title>Check Your Email | Polyphony Vault</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
	<div class="w-full max-w-md text-center">
		<!-- Email Icon -->
		<div class="mb-6">
			<svg
				class="mx-auto h-16 w-16 text-blue-500"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
				/>
			</svg>
		</div>

		<h1 class="mb-2 text-2xl font-bold text-gray-900">Check Your Email</h1>
		<p class="mb-8 text-gray-600">
			We sent a magic link to <strong class="text-gray-900">{email}</strong>
		</p>

		<div class="rounded-xl bg-white p-6 shadow-sm">
			<p class="mb-4 text-sm text-gray-500">
				Click the link in the email, or enter the 6-character code below:
			</p>

			<form onsubmit={(e) => { e.preventDefault(); verifyCode(); }}>
				<input
					type="text"
					value={code}
					oninput={handleCodeInput}
					placeholder="ABC123"
					maxlength="6"
					autocomplete="one-time-code"
					class="w-full rounded-lg border border-gray-300 px-4 py-4 text-center font-mono text-3xl uppercase tracking-[0.3em] focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
				/>

				<button
					type="submit"
					disabled={code.length !== 6 || isVerifying}
					class="mt-4 w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isVerifying ? 'Verifying...' : 'Verify Code'}
				</button>
			</form>

			<p class="mt-6 text-sm text-gray-500">
				Didn't receive it?
				<button onclick={resendCode} class="text-blue-600 hover:underline">
					Try again
				</button>
			</p>
		</div>

		<p class="mt-8 text-sm text-gray-400">
			The code expires in 10 minutes.
		</p>
	</div>
</div>
