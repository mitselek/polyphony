import { describe, it, expect } from 'vitest';
import type { OrgId } from './index';
import { createOrgId } from './index';

describe('OrgId branded type', () => {
	it('createOrgId returns a value usable as string', () => {
		const id = createOrgId('org_test_001');
		// Should work as a string
		expect(id.startsWith('org_')).toBe(true);
		expect(typeof id).toBe('string');
	});

	it('createOrgId output is assignable to OrgId', () => {
		const id: OrgId = createOrgId('org_test_001');
		expect(id).toBe('org_test_001');
	});

	it('plain string is NOT assignable to OrgId', () => {
		// This line must cause a compile error:
		// @ts-expect-error — raw string cannot be assigned to OrgId
		const id: OrgId = 'org_test_001';
		// Runtime: works fine (brands are erased), but TS catches it
		expect(id).toBe('org_test_001');
	});

	it('OrgId is assignable to string (for SQL interpolation)', () => {
		const id = createOrgId('org_test_001');
		const str: string = id; // Should compile fine
		expect(str).toBe('org_test_001');
	});
});
