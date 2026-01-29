// Unit tests for copy-assignments database layer
// Issue #116 - Copy Assignment/Return workflow

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	assignCopy,
	returnCopy,
	getActiveAssignments,
	getAssignmentHistory,
	getMemberAssignments,
	isAssigned
} from './copy-assignments';

// Mock D1 database
function createMockDb() {
	return {
		prepare: vi.fn().mockReturnThis(),
		bind: vi.fn().mockReturnThis(),
		first: vi.fn(),
		all: vi.fn(),
		run: vi.fn()
	};
}

describe('Copy assignments database layer', () => {
	let db: ReturnType<typeof createMockDb>;

	beforeEach(() => {
		db = createMockDb();
	});

	describe('assignCopy', () => {
		it('assigns copy to member', async () => {
			// First call: check if copy is assigned (returns null = not assigned)
			db.first.mockResolvedValueOnce(null);
			// Second call: insert assignment
			db.run.mockResolvedValueOnce({ meta: { changes: 1 } });
			// Third call: fetch created assignment
			db.first.mockResolvedValueOnce({
				id: 'assign-123',
				copy_id: 'copy-1',
				member_id: 'member-1',
				assigned_at: '2026-01-29T12:00:00.000Z',
				assigned_by: 'admin-1',
				returned_at: null,
				notes: 'Concert set'
			});

			const result = await assignCopy(db as unknown as D1Database, {
				copyId: 'copy-1',
				memberId: 'member-1',
				assignedBy: 'admin-1',
				notes: 'Concert set'
			});

			expect(result).toEqual({
				id: 'assign-123',
				copyId: 'copy-1',
				memberId: 'member-1',
				assignedAt: '2026-01-29T12:00:00.000Z',
				assignedBy: 'admin-1',
				returnedAt: null,
				notes: 'Concert set'
			});
		});

		it('throws error if copy already assigned', async () => {
			// Copy is already assigned
			db.first.mockResolvedValueOnce({ id: 'existing-assignment' });

			await expect(
				assignCopy(db as unknown as D1Database, {
					copyId: 'copy-1',
					memberId: 'member-1',
					assignedBy: 'admin-1'
				})
			).rejects.toThrow('Copy is already assigned');
		});

		it('assigns without notes', async () => {
			db.first.mockResolvedValueOnce(null);
			db.run.mockResolvedValueOnce({ meta: { changes: 1 } });
			db.first.mockResolvedValueOnce({
				id: 'assign-456',
				copy_id: 'copy-2',
				member_id: 'member-2',
				assigned_at: '2026-01-29T12:00:00.000Z',
				assigned_by: 'admin-1',
				returned_at: null,
				notes: null
			});

			const result = await assignCopy(db as unknown as D1Database, {
				copyId: 'copy-2',
				memberId: 'member-2',
				assignedBy: 'admin-1'
			});

			expect(result.notes).toBeNull();
		});
	});

	describe('returnCopy', () => {
		it('marks assignment as returned', async () => {
			db.run.mockResolvedValueOnce({ meta: { changes: 1 } });
			db.first.mockResolvedValueOnce({
				id: 'assign-123',
				copy_id: 'copy-1',
				member_id: 'member-1',
				assigned_at: '2026-01-29T12:00:00.000Z',
				assigned_by: 'admin-1',
				returned_at: '2026-01-30T12:00:00.000Z',
				notes: null
			});

			const result = await returnCopy(db as unknown as D1Database, 'assign-123');

			expect(result).not.toBeNull();
			expect(result?.returnedAt).toBe('2026-01-30T12:00:00.000Z');
		});

		it('returns null for non-existent assignment', async () => {
			db.run.mockResolvedValueOnce({ meta: { changes: 0 } });

			const result = await returnCopy(db as unknown as D1Database, 'nonexistent');

			expect(result).toBeNull();
		});
	});

	describe('getActiveAssignments', () => {
		it('returns only non-returned assignments for a copy', async () => {
			db.all.mockResolvedValueOnce({
				results: [
					{
						id: 'assign-1',
						copy_id: 'copy-1',
						member_id: 'member-1',
						assigned_at: '2026-01-29T12:00:00.000Z',
						assigned_by: 'admin-1',
						returned_at: null,
						notes: null
					}
				]
			});

			const result = await getActiveAssignments(db as unknown as D1Database, 'copy-1');

			expect(result).toHaveLength(1);
			expect(result[0].returnedAt).toBeNull();
		});

		it('returns empty array when no active assignments', async () => {
			db.all.mockResolvedValueOnce({ results: [] });

			const result = await getActiveAssignments(db as unknown as D1Database, 'copy-1');

			expect(result).toEqual([]);
		});
	});

	describe('getAssignmentHistory', () => {
		it('returns full history including returned assignments', async () => {
			db.all.mockResolvedValueOnce({
				results: [
					{
						id: 'assign-2',
						copy_id: 'copy-1',
						member_id: 'member-2',
						assigned_at: '2026-01-29T12:00:00.000Z',
						assigned_by: 'admin-1',
						returned_at: null,
						notes: null
					},
					{
						id: 'assign-1',
						copy_id: 'copy-1',
						member_id: 'member-1',
						assigned_at: '2026-01-20T12:00:00.000Z',
						assigned_by: 'admin-1',
						returned_at: '2026-01-25T12:00:00.000Z',
						notes: 'Returned early'
					}
				]
			});

			const result = await getAssignmentHistory(db as unknown as D1Database, 'copy-1');

			expect(result).toHaveLength(2);
			expect(result[1].returnedAt).not.toBeNull();
		});
	});

	describe('getMemberAssignments', () => {
		it('returns all active assignments for a member', async () => {
			db.all.mockResolvedValueOnce({
				results: [
					{
						id: 'assign-1',
						copy_id: 'copy-1',
						member_id: 'member-1',
						assigned_at: '2026-01-29T12:00:00.000Z',
						assigned_by: 'admin-1',
						returned_at: null,
						notes: null
					},
					{
						id: 'assign-2',
						copy_id: 'copy-2',
						member_id: 'member-1',
						assigned_at: '2026-01-28T12:00:00.000Z',
						assigned_by: 'admin-1',
						returned_at: null,
						notes: null
					}
				]
			});

			const result = await getMemberAssignments(db as unknown as D1Database, 'member-1');

			expect(result).toHaveLength(2);
			expect(result.every((a: { memberId: string }) => a.memberId === 'member-1')).toBe(true);
		});

		it('can include returned assignments', async () => {
			db.all.mockResolvedValueOnce({
				results: [
					{
						id: 'assign-1',
						copy_id: 'copy-1',
						member_id: 'member-1',
						assigned_at: '2026-01-29T12:00:00.000Z',
						assigned_by: 'admin-1',
						returned_at: null,
						notes: null
					},
					{
						id: 'assign-2',
						copy_id: 'copy-2',
						member_id: 'member-1',
						assigned_at: '2026-01-20T12:00:00.000Z',
						assigned_by: 'admin-1',
						returned_at: '2026-01-25T12:00:00.000Z',
						notes: null
					}
				]
			});

			const result = await getMemberAssignments(db as unknown as D1Database, 'member-1', {
				includeReturned: true
			});

			expect(result).toHaveLength(2);
		});
	});

	describe('isAssigned', () => {
		it('returns true if copy has active assignment', async () => {
			db.first.mockResolvedValueOnce({ id: 'assign-1' });

			const result = await isAssigned(db as unknown as D1Database, 'copy-1');

			expect(result).toBe(true);
		});

		it('returns false if copy has no active assignment', async () => {
			db.first.mockResolvedValueOnce(null);

			const result = await isAssigned(db as unknown as D1Database, 'copy-1');

			expect(result).toBe(false);
		});
	});
});
