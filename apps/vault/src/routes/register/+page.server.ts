// Register page server - auth check and form handling
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getMemberById } from '$lib/server/db/members';
import { createOrganization, getOrganizationBySubdomain } from '$lib/server/db/organizations';
import { createMember } from '$lib/server/db/members';
import { addMemberToOrganization } from '$lib/server/db/member-organizations';
import { addMemberRoles } from '$lib/server/db/roles';

export const load: PageServerLoad = async ({ cookies, url, platform }) => {
	const memberId = cookies.get('member_id');

	// Not logged in → redirect to login with return URL
	if (!memberId || !platform?.env?.DB) {
		const returnUrl = encodeURIComponent('/register');
		redirect(302, `/login?redirect=${returnUrl}`);
	}

	// Get current member for email pre-fill
	const member = await getMemberById(platform.env.DB, memberId);
	if (!member) {
		// Invalid session
		cookies.delete('member_id', { path: '/' });
		const returnUrl = encodeURIComponent('/register');
		redirect(302, `/login?redirect=${returnUrl}`);
	}

	// Check if user already owns an organization
	// (For now, allow multiple orgs per user - can restrict later)

	return {
		email: member.email_id ?? '',
		name: member.name
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, platform }) => {
		const memberId = cookies.get('member_id');

		if (!memberId || !platform?.env?.DB) {
			return { success: false, error: 'Not authenticated' };
		}

		const db = platform.env.DB;

		// Get current member
		const member = await getMemberById(db, memberId);
		if (!member) {
			return { success: false, error: 'Invalid session' };
		}

		const formData = await request.formData();
		const name = formData.get('name')?.toString()?.trim();
		const contactEmail = formData.get('email')?.toString()?.trim();
		const subdomain = formData.get('subdomain')?.toString()?.toLowerCase()?.trim();

		// Validate required fields
		if (!name || !contactEmail || !subdomain) {
			return { success: false, error: 'All fields are required' };
		}

		// Validate subdomain format
		const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
		if (subdomain.length < 3 || subdomain.length > 30 || !subdomainRegex.test(subdomain)) {
			return { success: false, error: 'Invalid subdomain format' };
		}

		// Check subdomain availability
		const existing = await getOrganizationBySubdomain(db, subdomain);
		if (existing) {
			return { success: false, error: 'Subdomain already taken' };
		}

		// Reserved subdomains check
		const reserved = ['www', 'api', 'admin', 'app', 'mail', 'smtp', 'ftp', 'cdn', 'static', 'assets', 'registry', 'vault', 'polyphony', 'support', 'help', 'docs', 'blog', 'status', 'test', 'staging', 'dev', 'demo'];
		if (reserved.includes(subdomain)) {
			return { success: false, error: 'This subdomain is reserved' };
		}

		try {
			// Create organization (status: pending by default? Check schema)
			const org = await createOrganization(db, {
				name,
				subdomain,
				type: 'collective',
				contactEmail
			});

			// Create member record for this organization
			// The registering user becomes the owner
			// First, add member to the new organization
			await addMemberToOrganization(db, {
				memberId: member.id,
				orgId: org.id
				// invitedBy is omitted (self-registered)
			});

			// Add owner role for this organization
			await addMemberRoles(db, member.id, ['owner'], null, org.id);

			// TODO(#199): Replace console.log with email notification to admin
			// See Epic #199 for admin notification requirements
			console.log(`[REGISTRATION] New organization registered:
  Name: ${org.name}
  Subdomain: ${org.subdomain}
  Contact: ${contactEmail}
  Owner: ${member.name} (${member.email_id})
  Org ID: ${org.id}
  
  ACTION REQUIRED: Add custom domain in Cloudflare Pages dashboard`);

			// Redirect to success page
			redirect(302, `/register/success?org=${encodeURIComponent(org.name)}&subdomain=${subdomain}`);
		} catch (err) {
			console.error('Registration error:', err);
			return {
				success: false,
				error: err instanceof Error ? err.message : 'Registration failed'
			};
		}
	}
};
