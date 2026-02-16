/**
 * Determines whether a sticky header should remain pinned.
 *
 * Returns true while grid content extends below the viewport (keeping the header
 * visible for context). Returns false once the last row has cleared the viewport
 * bottom by at least `threshold` pixels — at that point all data is visible and
 * the header can scroll away.
 *
 * @param gridBottom - Bottom edge of the grid container relative to the viewport
 *                     (from getBoundingClientRect().bottom)
 * @param viewportHeight - window.innerHeight
 * @param threshold - Required clearance in px before unsticking (default 100)
 */
export function shouldHeaderStick(
	gridBottom: number,
	viewportHeight: number,
	threshold: number
): boolean {
	return gridBottom > viewportHeight - threshold;
}
