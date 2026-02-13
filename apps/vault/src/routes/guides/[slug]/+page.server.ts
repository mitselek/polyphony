import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getGuideBySlug } from '$lib/content/guides';
import { marked } from 'marked';

export const load: PageServerLoad = async ({ params }) => {
	const guide = getGuideBySlug(params.slug);

	if (!guide) {
		throw error(404, 'Guide not found');
	}

	// Get content in Estonian (primary), fall back to English
	const markdown = guide.content['et'] ?? guide.content['en'];
	if (!markdown) {
		throw error(404, 'Guide content not available');
	}

	// Render markdown to HTML
	const html = await marked(markdown, {
		gfm: true,
		breaks: false
	});

	return {
		guide,
		html
	};
};
