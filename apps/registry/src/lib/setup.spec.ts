import { describe, it, expect } from 'vitest';

describe('Registry setup', () => {
	it('can import from @polyphony/shared', async () => {
		const shared = await import('@polyphony/shared');
		// Shared package is accessible
		expect(shared).toBeDefined();
	});

	it('vitest is configured correctly', () => {
		expect(1 + 1).toBe(2);
	});
});
