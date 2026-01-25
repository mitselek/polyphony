<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let title = $state('');
	let composer = $state('');
	let arranger = $state('');
	let licenseType = $state<'public_domain' | 'licensed' | 'owned' | 'pending'>('pending');
	let file = $state<File | null>(null);

	let isUploading = $state(false);
	let uploadProgress = $state(0);
	let error = $state('');

	const MAX_SIZE = 9.5 * 1024 * 1024; // 9.5MB (5 chunks × 1.9MB)

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const selectedFile = input.files?.[0];

		if (!selectedFile) {
			file = null;
			return;
		}

		// Client-side validation
		if (selectedFile.type !== 'application/pdf') {
			error = 'Only PDF files are allowed';
			file = null;
			input.value = '';
			return;
		}

		if (selectedFile.size > MAX_SIZE) {
			error = 'File size must be under 9.5MB';
			file = null;
			input.value = '';
			return;
		}

		error = '';
		file = selectedFile;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!file || !title) {
			error = 'Title and file are required';
			return;
		}

		isUploading = true;
		uploadProgress = 0;
		error = '';

		try {
			const formData = new FormData();
			formData.append('title', title);
			formData.append('license_type', licenseType);
			formData.append('file', file);

			if (composer) formData.append('composer', composer);
			if (arranger) formData.append('arranger', arranger);

			// Simulate progress for better UX
			const progressInterval = setInterval(() => {
				if (uploadProgress < 90) {
					uploadProgress += 10;
				}
			}, 100);

			const response = await fetch('/api/scores', {
				method: 'POST',
				body: formData
			});

			clearInterval(progressInterval);

			if (!response.ok) {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message ?? 'Upload failed');
			}

			uploadProgress = 100;

			// Redirect to library after successful upload
			setTimeout(() => {
				goto('/library');
			}, 500);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Upload failed';
			isUploading = false;
			uploadProgress = 0;
		}
	}
</script>

<svelte:head>
	<title>Upload Score | Polyphony Vault</title>
</svelte:head>

<div class="container mx-auto max-w-xl px-4 py-8">
	<div class="mb-8">
		<a href="/library" class="text-blue-600 hover:underline">← Back to Library</a>
	</div>

	<h1 class="mb-6 text-3xl font-bold">Upload Score</h1>

	{#if !data.canUpload}
		<!-- Not authorized to upload -->
		<div class="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
			<svg
				class="mx-auto mb-4 h-16 w-16 text-gray-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
				/>
			</svg>
			<h2 class="mb-2 text-xl font-semibold text-gray-900">Authentication Required</h2>
			<p class="mb-6 text-gray-600">
				You need to be signed in as a librarian or admin to upload scores.
			</p>
			<a
				href="/api/auth/login"
				class="inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700"
			>
				Sign In with Google
			</a>
		</div>
	{:else}
		<!-- Upload form -->
		<form onsubmit={handleSubmit} class="space-y-6">
		<!-- Title -->
		<div>
			<label for="title" class="mb-1 block font-medium">
				Title <span class="text-red-500">*</span>
			</label>
			<input
				id="title"
				type="text"
				bind:value={title}
				required
				class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				placeholder="e.g., Ave Maria"
			/>
		</div>

		<!-- Composer -->
		<div>
			<label for="composer" class="mb-1 block font-medium">Composer</label>
			<input
				id="composer"
				type="text"
				bind:value={composer}
				class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				placeholder="e.g., Franz Schubert"
			/>
		</div>

		<!-- Arranger -->
		<div>
			<label for="arranger" class="mb-1 block font-medium">Arranger</label>
			<input
				id="arranger"
				type="text"
				bind:value={arranger}
				class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				placeholder="e.g., arr. John Smith"
			/>
		</div>

		<!-- License Type -->
		<div>
			<label for="license" class="mb-1 block font-medium">
				License Status <span class="text-red-500">*</span>
			</label>
			<select
				id="license"
				bind:value={licenseType}
				class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
			>
				<option value="public_domain">Public Domain</option>
				<option value="licensed">Licensed (purchased)</option>
				<option value="owned">Owned (original work)</option>
				<option value="pending">Pending Verification</option>
			</select>
		</div>

		<!-- File Upload -->
		<div>
			<label for="file" class="mb-1 block font-medium">
				PDF File <span class="text-red-500">*</span>
			</label>
			<input
				id="file"
				type="file"
				accept=".pdf,application/pdf"
				onchange={handleFileChange}
				class="w-full rounded-lg border border-gray-300 px-4 py-2 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-blue-700 hover:file:bg-blue-100"
			/>
			<p class="mt-1 text-sm text-gray-500">PDF only, max 9.5MB</p>
			{#if file}
				<p class="mt-1 text-sm text-green-600">
					Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
				</p>
			{/if}
		</div>

		<!-- Error Message -->
		{#if error}
			<div class="rounded-lg bg-red-50 p-4 text-red-600">
				{error}
			</div>
		{/if}

		<!-- Progress Bar -->
		{#if isUploading}
			<div class="relative h-2 overflow-hidden rounded-full bg-gray-200">
				<div
					class="absolute left-0 top-0 h-full bg-blue-600 transition-all duration-200"
					style="width: {uploadProgress}%"
				></div>
			</div>
			<p class="text-center text-sm text-gray-600">Uploading... {uploadProgress}%</p>
		{/if}

		<!-- Submit Button -->
		<button
			type="submit"
			disabled={isUploading || !title || !file}
			class="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{isUploading ? 'Uploading...' : 'Upload Score'}
		</button>
	</form>
	{/if}
</div>
