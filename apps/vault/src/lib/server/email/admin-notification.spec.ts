// Tests for admin notification email service
// TDD: Tests written first per DEVELOPER-WORKFLOW.md

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	sendAdminNotification,
	buildAdminNotificationEmail,
	type RegistrationNotificationData
} from './admin-notification';

// Mock fetch for Resend API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Admin Notification Email', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const testData: RegistrationNotificationData = {
		orgName: 'City Chamber Choir',
		subdomain: 'citychamber',
		contactEmail: 'admin@citychoir.org',
		memberName: 'John Director',
		memberEmail: 'john@example.com',
		orgId: 'org_abc123'
	};

	describe('buildAdminNotificationEmail', () => {
		it('builds email with all required fields', () => {
			const email = buildAdminNotificationEmail(testData, 'admin@polyphony.uk');

			expect(email.to).toBe('admin@polyphony.uk');
			expect(email.subject).toBe('New Polyphony Registration: City Chamber Choir');
			expect(email.text).toContain('City Chamber Choir');
			expect(email.text).toContain('citychamber.polyphony.uk');
			expect(email.text).toContain('admin@citychoir.org');
			expect(email.text).toContain('John Director');
			expect(email.text).toContain('john@example.com');
			expect(email.text).toContain('org_abc123');
		});

		it('includes action required section', () => {
			const email = buildAdminNotificationEmail(testData, 'admin@polyphony.uk');

			expect(email.text).toContain('ACTION REQUIRED');
			expect(email.text).toContain('Cloudflare Pages');
		});

		it('uses from address with Polyphony domain', () => {
			const email = buildAdminNotificationEmail(testData, 'admin@polyphony.uk');

			expect(email.from).toContain('polyphony');
		});
	});

	describe('sendAdminNotification', () => {
		it('sends email successfully via Resend API', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ id: 'email_123' })
			});

			const result = await sendAdminNotification(testData, {
				resendApiKey: 'test_api_key',
				adminEmail: 'admin@polyphony.uk'
			});

			expect(result.success).toBe(true);
			expect(result.emailId).toBe('email_123');

			// Verify API call
			expect(mockFetch).toHaveBeenCalledOnce();
			const [url, options] = mockFetch.mock.calls[0];
			expect(url).toBe('https://api.resend.com/emails');
			expect(options.method).toBe('POST');
			expect(options.headers['Authorization']).toBe('Bearer test_api_key');

			const body = JSON.parse(options.body);
			expect(body.to).toBe('admin@polyphony.uk');
			expect(body.subject).toContain('City Chamber Choir');
		});

		it('handles API error gracefully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				json: async () => ({ message: 'Invalid API key' })
			});

			const result = await sendAdminNotification(testData, {
				resendApiKey: 'invalid_key',
				adminEmail: 'admin@polyphony.uk'
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('401');
		});

		it('handles network error gracefully', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await sendAdminNotification(testData, {
				resendApiKey: 'test_api_key',
				adminEmail: 'admin@polyphony.uk'
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('Network error');
		});

		it('does nothing when API key is missing', async () => {
			const result = await sendAdminNotification(testData, {
				resendApiKey: '',
				adminEmail: 'admin@polyphony.uk'
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('not configured');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('does nothing when admin email is missing', async () => {
			const result = await sendAdminNotification(testData, {
				resendApiKey: 'test_api_key',
				adminEmail: ''
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('not configured');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('logs but does not throw on failure', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			mockFetch.mockRejectedValueOnce(new Error('API down'));

			// Should not throw
			const result = await sendAdminNotification(testData, {
				resendApiKey: 'test_api_key',
				adminEmail: 'admin@polyphony.uk'
			});

			expect(result.success).toBe(false);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});
});
