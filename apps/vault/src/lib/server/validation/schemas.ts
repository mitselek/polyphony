// Zod validation schemas for API requests
import { z } from 'zod';
import { error } from '@sveltejs/kit';

// Role enum matching the database
const roleSchema = z.enum(['owner', 'admin', 'librarian']);

// Voice part enum matching the database
const voicePartSchema = z.enum(['S', 'A', 'T', 'B', 'SA', 'AT', 'TB', 'SAT', 'ATB', 'SATB']);

/**
 * Schema for creating a new member invitation
 */
export const createInviteSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	roles: z.array(roleSchema).optional().default([]),
	voicePart: voicePartSchema.nullable().optional()
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
 * Schema for updating member voice part
 */
export const updateVoicePartSchema = z.object({
	voicePart: voicePartSchema.nullable()
});

export type UpdateVoicePartInput = z.infer<typeof updateVoicePartSchema>;

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
