// Zod validation schemas for API requests
import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { ASSIGNABLE_ROLES } from '$lib/types';

// Role enum matching the database - uses ASSIGNABLE_ROLES constant to stay in sync
const roleSchema = z.enum(ASSIGNABLE_ROLES);

// Event type enum matching the database
const eventTypeSchema = z.enum(['rehearsal', 'concert', 'retreat']);

/**
 * Schema for creating a new member invitation
 */
export const createInviteSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	roles: z.array(roleSchema).optional().default([]),
	voiceIds: z.array(z.string()).optional().default([]),
	sectionIds: z.array(z.string()).optional().default([])
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

/**
 * Schema for updating member roles
 */
export const updateRolesSchema = z.object({
	role: roleSchema,
	action: z.enum(['add', 'remove'])
});

export type UpdateRolesInput = z.infer<typeof updateRolesSchema>;

/**
 * Schema for updating vault settings
 * TODO Phase 3: Add default_voices array
 */
export const updateSettingsSchema = z.object({
	default_event_duration: z.coerce.number().int().positive().optional(),
	conductor_id: z.string().optional()
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/**
 * Schema for creating events (supports batch creation)
 */
export const createEventsSchema = z.object({
	events: z.array(
		z.object({
			title: z.string().min(1, 'Title is required'),
			description: z.string().optional(),
			location: z.string().optional(),
			starts_at: z.string().datetime('Invalid start time format'),
			ends_at: z.string().datetime('Invalid end time format').optional(),
			event_type: eventTypeSchema
		})
	).min(1, 'At least one event is required')
});

export type CreateEventsInput = z.infer<typeof createEventsSchema>;

/**
 * Schema for updating an event
 */
export const updateEventSchema = z.object({
	title: z.string().min(1, 'Title is required').optional(),
	description: z.string().optional(),
	location: z.string().optional(),
	starts_at: z.string().datetime('Invalid start time format').optional(),
	ends_at: z.string().datetime('Invalid end time format').optional()
});

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

/**
 * Schema for adding a score to an event program
 */
export const addToProgramSchema = z.object({
	score_id: z.string().min(1, 'Score ID is required'),
	position: z.number().int().nonnegative('Position must be non-negative'),
	notes: z.string().optional()
});

export type AddToProgramInput = z.infer<typeof addToProgramSchema>;

/**
 * Parse and validate request body against a Zod schema.
 * Throws SvelteKit error with appropriate status code on failure.
 */
export async function parseBody<T>(request: Request, schema: z.Schema<T>): Promise<T> {
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const result = schema.safeParse(json);

	if (!result.success) {
		// Format Zod errors into a readable message
		const messages = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
		throw error(400, messages.join(', ') || 'Validation failed');
	}

	return result.data;
}
