// Tests for Zod validation schemas
import { describe, it, expect, vi } from 'vitest';
import {
	createInviteSchema,
	updateRolesSchema,
	parseBody
} from '$lib/server/validation/schemas';

describe('createInviteSchema', () => {
	it('validates a valid invite', () => {
		const result = createInviteSchema.safeParse({
			name: 'John Doe',
			roles: ['admin', 'librarian']
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.name).toBe('John Doe');
			expect(result.data.roles).toEqual(['admin', 'librarian']);
		}
	});

	it('requires name', () => {
		const result = createInviteSchema.safeParse({ roles: [] });
		expect(result.success).toBe(false);
	});

	it('rejects empty name', () => {
		const result = createInviteSchema.safeParse({ name: '', roles: [] });
		expect(result.success).toBe(false);
	});

	it('defaults roles to empty array', () => {
		const result = createInviteSchema.safeParse({ name: 'Test' });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.roles).toEqual([]);
		}
	});

	it('rejects invalid role', () => {
		const result = createInviteSchema.safeParse({
			name: 'Test',
			roles: ['invalid_role']
		});
		expect(result.success).toBe(false);
	});
});

describe('updateRolesSchema', () => {
	it('validates add action', () => {
		const result = updateRolesSchema.safeParse({ role: 'admin', action: 'add' });
		expect(result.success).toBe(true);
	});

	it('validates remove action', () => {
		const result = updateRolesSchema.safeParse({ role: 'librarian', action: 'remove' });
		expect(result.success).toBe(true);
	});

	it('rejects invalid role', () => {
		const result = updateRolesSchema.safeParse({ role: 'superadmin', action: 'add' });
		expect(result.success).toBe(false);
	});

	it('rejects invalid action', () => {
		const result = updateRolesSchema.safeParse({ role: 'admin', action: 'toggle' });
		expect(result.success).toBe(false);
	});

	it('requires both role and action', () => {
		expect(updateRolesSchema.safeParse({ role: 'admin' }).success).toBe(false);
		expect(updateRolesSchema.safeParse({ action: 'add' }).success).toBe(false);
	});
});

describe('parseBody', () => {
	it('parses valid JSON and validates', async () => {
		const request = new Request('http://test', {
			method: 'POST',
			body: JSON.stringify({ name: 'Test', roles: ['admin'] }),
			headers: { 'Content-Type': 'application/json' }
		});

		const result = await parseBody(request, createInviteSchema);
		expect(result.name).toBe('Test');
		expect(result.roles).toEqual(['admin']);
	});

	it('throws on invalid JSON', async () => {
		const request = new Request('http://test', {
			method: 'POST',
			body: 'not json',
			headers: { 'Content-Type': 'application/json' }
		});

		await expect(parseBody(request, createInviteSchema)).rejects.toThrow();
	});

	it('throws on validation failure with message', async () => {
		const request = new Request('http://test', {
			method: 'POST',
			body: JSON.stringify({ name: '' }),
			headers: { 'Content-Type': 'application/json' }
		});

		await expect(parseBody(request, createInviteSchema)).rejects.toThrow();
	});
});
