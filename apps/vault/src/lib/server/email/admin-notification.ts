// Admin notification email for new organization registrations
// Sends email to admin when a new organization is registered

export interface RegistrationNotificationData {
	orgName: string;
	subdomain: string;
	contactEmail: string;
	memberName: string;
	memberEmail: string;
	orgId: string;
}

export interface EmailConfig {
	resendApiKey: string;
	adminEmail: string;
}

export interface SendResult {
	success: boolean;
	emailId?: string;
	error?: string;
}

export interface EmailPayload {
	from: string;
	to: string;
	subject: string;
	text: string;
}

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'Polyphony <noreply@polyphony.uk>';

/**
 * Build the email content for admin notification
 */
export function buildAdminNotificationEmail(
	data: RegistrationNotificationData,
	adminEmail: string
): EmailPayload {
	const subject = `New Polyphony Registration: ${data.orgName}`;

	const text = `New organization registered:

Name: ${data.orgName}
Subdomain: ${data.subdomain}.polyphony.uk
Contact: ${data.contactEmail}
Registered by: ${data.memberName} (${data.memberEmail})
Org ID: ${data.orgId}

ACTION REQUIRED:
1. Add custom domain in Cloudflare Pages
2. Update organization status to 'active'
`;

	return {
		from: FROM_ADDRESS,
		to: adminEmail,
		subject,
		text
	};
}

/**
 * Send admin notification email for new registration
 * Gracefully handles failures - logs error but doesn't throw
 */
export async function sendAdminNotification(
	data: RegistrationNotificationData,
	config: EmailConfig
): Promise<SendResult> {
	// Validate configuration
	if (!config.resendApiKey || !config.adminEmail) {
		const error = 'Email service not configured (missing API key or admin email)';
		console.warn(`[Admin Notification] ${error}`);
		return { success: false, error };
	}

	const email = buildAdminNotificationEmail(data, config.adminEmail);

	try {
		const response = await fetch(RESEND_API_URL, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${config.resendApiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(email)
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const error = `Resend API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`;
			console.error(`[Admin Notification] ${error}`);
			return { success: false, error };
		}

		const result = await response.json() as { id: string };
		console.log(`[Admin Notification] Email sent successfully: ${result.id}`);
		return { success: true, emailId: result.id };
	} catch (err) {
		const error = err instanceof Error ? err.message : 'Unknown error';
		console.error(`[Admin Notification] Failed to send email: ${error}`);
		return { success: false, error };
	}
}
