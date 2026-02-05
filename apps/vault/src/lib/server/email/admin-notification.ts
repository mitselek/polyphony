// Admin notification via Registry API
// Issue #202 - Calls Registry endpoint instead of Resend directly
// This centralizes email sending in Registry (which already has Resend configured)

export interface RegistrationNotificationData {
	orgName: string;
	subdomain: string;
	contactEmail: string;
	memberName: string;
	memberEmail: string;
	orgId: string;
}

export interface NotifyConfig {
	registryUrl: string;
	notifyApiKey: string;
}

export interface SendResult {
	success: boolean;
	emailId?: string;
	error?: string;
}

/**
 * Send admin notification for new registration via Registry API
 * Registry handles the actual email sending via Resend
 * Gracefully handles failures - logs error but doesn't throw
 */
export async function sendAdminNotification(
	data: RegistrationNotificationData,
	config: NotifyConfig
): Promise<SendResult> {
	// Validate configuration
	if (!config.registryUrl || !config.notifyApiKey) {
		const error = 'Notification service not configured (missing Registry URL or API key)';
		console.warn(`[Admin Notification] ${error}`);
		return { success: false, error };
	}

	const url = `${config.registryUrl}/api/notify/registration`;

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				apiKey: config.notifyApiKey,
				...data
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({})) as { error?: string };
			const error = `Registry API error: ${response.status} - ${errorData.error || 'Unknown error'}`;
			console.error(`[Admin Notification] ${error}`);
			return { success: false, error };
		}

		const result = await response.json() as { success: boolean; emailId?: string };
		if (result.success) {
			console.log(`[Admin Notification] Email sent via Registry: ${result.emailId}`);
			return { success: true, emailId: result.emailId };
		} else {
			return { success: false, error: 'Registry returned failure' };
		}
	} catch (err) {
		const error = err instanceof Error ? err.message : 'Unknown error';
		console.error(`[Admin Notification] Failed to call Registry: ${error}`);
		return { success: false, error };
	}
}
