// Events database operations
import type { EventType } from '$lib/types';
import { nanoid } from 'nanoid';

export interface Event {
	id: string;
	title: string;
	description: string | null;
	location: string | null;
	starts_at: string;
	ends_at: string | null;
	event_type: EventType;
	created_by: string;
	created_at: string;
}

export interface CreateEventInput {
	title: string;
	description?: string;
	location?: string;
	starts_at: string;
	ends_at?: string;
	event_type: EventType;
}

export interface UpdateEventInput {
	title?: string;
	description?: string;
	location?: string;
	starts_at?: string;
	ends_at?: string;
}

/**
 * Create multiple events (for batch operations like recurring events)
 */
export async function createEvents(
	db: D1Database,
	events: CreateEventInput[],
	createdBy: string
): Promise<Event[]> {
	const createdEvents: Event[] = [];

	// Batch insert all events
	const statements = events.map((event) => {
		const id = nanoid();
		const created_at = new Date().toISOString();
		
		createdEvents.push({
			id,
			title: event.title,
			description: event.description ?? null,
			location: event.location ?? null,
			starts_at: event.starts_at,
			ends_at: event.ends_at ?? null,
			event_type: event.event_type,
			created_by: createdBy,
			created_at
		});

		return db
			.prepare(
				'INSERT INTO events (id, title, description, location, starts_at, ends_at, event_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
			)
			.bind(
				id,
				event.title,
				event.description ?? null,
				event.location ?? null,
				event.starts_at,
				event.ends_at ?? null,
				event.event_type,
				createdBy
			);
	});

	await db.batch(statements);

	return createdEvents;
}

/**
 * Get upcoming events (starts_at >= now) ordered by start time
 */
export async function getUpcomingEvents(db: D1Database): Promise<Event[]> {
	const { results } = await db
		.prepare(
			`SELECT id, title, description, location, starts_at, ends_at, event_type, created_by, created_at 
			FROM events 
			WHERE starts_at >= datetime('now') 
			ORDER BY starts_at ASC`
		)
		.all<Event>();

	return results;
}

/**
 * Get event by ID
 */
export async function getEventById(db: D1Database, id: string): Promise<Event | null> {
	const event = await db
		.prepare(
			'SELECT id, title, description, location, starts_at, ends_at, event_type, created_by, created_at FROM events WHERE id = ?'
		)
		.bind(id)
		.first<Event>();

	return event;
}

/**
 * Update event fields
 */
export async function updateEvent(
	db: D1Database,
	id: string,
	input: UpdateEventInput
): Promise<boolean> {
	// Get current event to merge with updates
	const current = await getEventById(db, id);
	if (!current) {
		return false;
	}

	const result = await db
		.prepare(
			'UPDATE events SET title = ?, description = ?, location = ?, starts_at = ?, ends_at = ? WHERE id = ?'
		)
		.bind(
			input.title ?? current.title,
			input.description ?? current.description,
			input.location ?? current.location,
			input.starts_at ?? current.starts_at,
			input.ends_at ?? current.ends_at,
			id
		)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

/**
 * Delete event (cascades to event_programs via ON DELETE CASCADE)
 */
export async function deleteEvent(db: D1Database, id: string): Promise<boolean> {
	const result = await db.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
	return (result.meta.changes ?? 0) > 0;
}
