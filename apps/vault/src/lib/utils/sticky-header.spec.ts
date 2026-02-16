import { describe, it, expect } from 'vitest';
import { shouldHeaderStick } from './sticky-header';

describe('shouldHeaderStick', () => {
	const THRESHOLD = 100;

	it('sticks when grid extends below the viewport', () => {
		// gridBottom is beyond viewport
		expect(shouldHeaderStick(1200, 800, THRESHOLD)).toBe(true);
	});

	it('sticks when grid bottom is at the viewport bottom', () => {
		// gridBottom === viewportHeight — no clearance yet
		expect(shouldHeaderStick(800, 800, THRESHOLD)).toBe(true);
	});

	it('sticks when grid bottom is just inside the viewport (under threshold)', () => {
		// gridBottom is 50px above viewport bottom — not enough clearance
		expect(shouldHeaderStick(750, 800, THRESHOLD)).toBe(true);
	});

	it('sticks at exactly 1px before threshold', () => {
		// gridBottom is 99px above viewport bottom — still sticky
		expect(shouldHeaderStick(701, 800, THRESHOLD)).toBe(true);
	});

	it('unsticks at exactly the threshold boundary', () => {
		// gridBottom is exactly 100px above viewport bottom
		expect(shouldHeaderStick(700, 800, THRESHOLD)).toBe(false);
	});

	it('unsticks when grid has cleared well past the threshold', () => {
		// gridBottom is 300px above viewport bottom
		expect(shouldHeaderStick(500, 800, THRESHOLD)).toBe(false);
	});

	it('unsticks when grid is scrolled completely off-screen above', () => {
		// gridBottom is negative (scrolled above viewport)
		expect(shouldHeaderStick(-200, 800, THRESHOLD)).toBe(false);
	});

	it('works with different threshold values', () => {
		// Custom threshold of 50px
		expect(shouldHeaderStick(760, 800, 50)).toBe(true);
		expect(shouldHeaderStick(750, 800, 50)).toBe(false);
	});
});
