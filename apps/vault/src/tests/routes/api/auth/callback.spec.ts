// Tests for GET /api/auth/callback endpoint with voices/sections transfer
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SvelteKit functions BEFORE importing the handler
vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => {
		const err = new Error(`Redirect to ${location}`);
		(err as any).status = status;
		(err as any).location = location;
		throw err;
	},
	error: (status: number, message: string) => {
		const err = new Error(message);
		(err as any).status = status;
		throw err;
	}
}));

import { GET } from '../../../../routes/api/auth/callback/+server';

// Mock members db
vi.mock('$lib/server/db/members', () => ({
	getMemberByEmailId: vi.fn(),
	createMember: vi.fn()
}));

// Mock invites db
vi.mock('$lib/server/db/invites', () => ({
	acceptInvite: vi.fn()
}));

// Mock jose library
vi.mock('jose', () => ({
	importJWK: vi.fn(),
	jwtVerify: vi.fn()
}));

import { getMemberByEmailId, createMember } from '$lib/server/db/members';
import { acceptInvite } from '$lib/server/db/invites';
import { importJWK, jwtVerify } from 'jose';

function createMockURL(token: string, inviteToken?: string) {
	const url = new URL('http://localhost:5173/api/auth/callback');
	url.searchParams.set('token', token);
	return url;
}

function createMockCookies(inviteToken?: string) {
	const cookies = new Map<string, string>();
	if (inviteToken) {
		cookies.set('invite_token', inviteToken);
	}
	
	return {
		get: vi.fn((name: string) => cookies.get(name)),
		set: vi.fn((name: string, value: string) => cookies.set(name, value)),
		delete: vi.fn((name: string) => cookies.delete(name))
	};
}

function createMockFetch(jwksResponse: any) {
	return vi.fn().mockResolvedValue({
		ok: true,
		json: async () => jwksResponse
	});
}

describe('GET /api/auth/callback', () => {
	const mockJWKS = {
		keys: [
			{
				kid: 'key-1',
				kty: 'OKP',
				crv: 'Ed25519',
				x: 'mock-x-coordinate',
				alg: 'EdDSA'
			}
		]
	};

	const mockPublicKey = {};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(importJWK).mockResolvedValue(mockPublicKey as any);
	});

	it('transfers voices and sections from invite to new member', async () => {
		const mockPayload = {
			email: 'newmember@test.com',
			name: 'New Member',
			aud: 'localhost-dev-vault'  // Match expected vault ID
		};

		const mockMember = {
			id: 'member-new',
			email: 'newmember@test.com',
			name: 'New Member',
			roles: ['librarian'],
			voices: [
				{ id: 'voice-soprano', name: 'Soprano', abbreviation: 'S' }
			],
			sections: [
				{ id: 'section-soprano-1', name: 'Soprano 1', abbreviation: 'S1' }
			]
		};

		vi.mocked(jwtVerify).mockResolvedValue({
			payload: mockPayload,
			protectedHeader: { alg: 'EdDSA' }
		} as any);

		vi.mocked(acceptInvite).mockResolvedValue({
			success: true,
			memberId: 'member-new',
			member: mockMember
		} as any);

		const cookies = createMockCookies('invite-token-123');
		const mockFetch = createMockFetch(mockJWKS);

		try {
			await GET({
				url: createMockURL('valid-jwt-token'),
				platform: { env: { DB: {} } },
				cookies,
				fetch: mockFetch
			} as any);
			
			// Should not reach here - expect redirect
			expect.fail('Expected redirect to be thrown');
		} catch (err: any) {
			// Verify redirect to welcome page
			expect(err.location).toBe('/welcome');
			expect(err.status).toBe(302);
		}

		// Verify acceptInvite was called with correct parameters (no name parameter)
		expect(acceptInvite).toHaveBeenCalledWith(
			{},
			'invite-token-123',
			'newmember@test.com'
		);

		// Verify invite token cookie was deleted
		expect(cookies.delete).toHaveBeenCalledWith('invite_token', { path: '/' });

		// Verify member_id cookie was set
		expect(cookies.set).toHaveBeenCalledWith(
			'member_id',
			'member-new',
			expect.objectContaining({ httpOnly: true })
		);
	});

	it('creates member with empty voices/sections when no invite', async () => {
		const mockPayload = {
			email: 'nomember@test.com',
			name: 'No Invite Member',
			aud: 'localhost-dev-vault'
		};

		const mockNewMember = {
			id: 'member-auto',
			email: 'nomember@test.com',
			name: 'No Invite Member',
			roles: [],
			voices: [],
			sections: []
		};

		vi.mocked(jwtVerify).mockResolvedValue({
			payload: mockPayload,
			protectedHeader: { alg: 'EdDSA' }
		} as any);

		vi.mocked(getMemberByEmailId).mockResolvedValue(null);
		vi.mocked(createMember).mockResolvedValue(mockNewMember as any);

		const cookies = createMockCookies(); // No invite token
		const mockFetch = createMockFetch(mockJWKS);

		try {
			await GET({
				url: createMockURL('valid-jwt-token'),
				platform: { env: { DB: {} } },
				cookies,
				fetch: mockFetch
			} as any);
			
			expect.fail('Expected redirect to be thrown');
		} catch (err: any) {
			// Verify redirect to library page
			expect(err.location).toBe('/library');
			expect(err.status).toBe(302);
		}

		// Verify createMember was called with empty roles (no voices/sections in params)
		expect(createMember).toHaveBeenCalledWith(
			{},
			{
				email: 'nomember@test.com',
				name: 'No Invite Member',
				roles: []
			}
		);

		// Verify member_id cookie was set
		expect(cookies.set).toHaveBeenCalledWith(
			'member_id',
			'member-auto',
			expect.objectContaining({ httpOnly: true })
		);
	});

	it('handles existing member login without modifying voices/sections', async () => {
		const mockPayload = {
			email: 'existing@test.com',
			name: 'Existing Member',
			aud: 'localhost-dev-vault'
		};

		const mockExistingMember = {
			id: 'member-existing',
			email: 'existing@test.com',
			name: 'Existing Member',
			roles: ['admin'],
			voices: [
				{ id: 'voice-alto', name: 'Alto', abbreviation: 'A' }
			],
			sections: [
				{ id: 'section-alto', name: 'Alto', abbreviation: 'A' }
			]
		};

		vi.mocked(jwtVerify).mockResolvedValue({
			payload: mockPayload,
			protectedHeader: { alg: 'EdDSA' }
		} as any);

		vi.mocked(getMemberByEmailId).mockResolvedValue(mockExistingMember as any);

		const cookies = createMockCookies(); // No invite token
		const mockFetch = createMockFetch(mockJWKS);

		try {
			await GET({
				url: createMockURL('valid-jwt-token'),
				platform: { env: { DB: {} } },
				cookies,
				fetch: mockFetch
			} as any);
			
			expect.fail('Expected redirect to be thrown');
		} catch (err: any) {
			expect(err.location).toBe('/library');
		}

		// Verify createMember was NOT called
		expect(createMember).not.toHaveBeenCalled();
		
		// Verify acceptInvite was NOT called (no invite token)
		expect(acceptInvite).not.toHaveBeenCalled();
	});

	it('falls back to normal member creation if invite acceptance fails', async () => {
		const mockPayload = {
			email: 'failinvite@test.com',
			name: 'Failed Invite',
			aud: 'localhost-dev-vault'
		};

		const mockFallbackMember = {
			id: 'member-fallback',
			email: 'failinvite@test.com',
			name: 'Failed Invite',
			roles: [],
			voices: [],
			sections: []
		};

		vi.mocked(jwtVerify).mockResolvedValue({
			payload: mockPayload,
			protectedHeader: { alg: 'EdDSA' }
		} as any);

		// acceptInvite fails
		vi.mocked(acceptInvite).mockResolvedValue({
			success: false,
			error: 'Invalid invite token'
		} as any);

		// Fall back to normal member creation
		vi.mocked(getMemberByEmailId).mockResolvedValue(null);
		vi.mocked(createMember).mockResolvedValue(mockFallbackMember as any);

		const cookies = createMockCookies('bad-invite-token');
		const mockFetch = createMockFetch(mockJWKS);

		try {
			await GET({
				url: createMockURL('valid-jwt-token'),
				platform: { env: { DB: {} } },
				cookies,
				fetch: mockFetch
			} as any);
			
			expect.fail('Expected redirect to be thrown');
		} catch (err: any) {
			expect(err.location).toBe('/library');
		}

		// Verify invite token cookie was deleted
		expect(cookies.delete).toHaveBeenCalledWith('invite_token', { path: '/' });

		// Verify fallback to createMember
		expect(createMember).toHaveBeenCalled();
	});

	it('rejects token with wrong audience', async () => {
		const mockPayload = {
			email: 'test@test.com',
			name: 'Test',
			aud: 'wrong-vault-id'
		};

		vi.mocked(jwtVerify).mockResolvedValue({
			payload: mockPayload,
			protectedHeader: { alg: 'EdDSA' }
		} as any);

		const cookies = createMockCookies();
		const mockFetch = createMockFetch(mockJWKS);

		await expect(
			GET({
				url: createMockURL('valid-jwt-token'),
				platform: { env: { DB: {} } },
				cookies,
				fetch: mockFetch
			} as any)
		).rejects.toThrow('Token not issued for this vault');
	});
});
