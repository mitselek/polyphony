import { describe, it, expect } from 'vitest';

describe('Registry setup', () => {
	it('can import from @polyphony/shared', async () => {
		const { AuthToken } = await import('@polyphony/shared');
		// Type exists - this compiles
		expect(true).toBe(true);
	});

	it('vitest is configured correctly', () => {
		expect(1 + 1).toBe(2);
	});
});
