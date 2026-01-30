// Seasons database operations
// Seasons define date-based groupings for events
// Events belong to seasons by date, not explicit FK

import { nanoid } from 'nanoid';
import type { Event } from './events';

export interface Season {
	id: string;
	name: string;
	start_date: string; // YYYY-MM-DD
	created_at: string;
	updated_at: string;
}

export interface CreateSeasonInput {
	name: string;
	start_date: string; // YYYY-MM-DD
}

export interface UpdateSeasonInput {
	name?: string;
	start_date?: string;
}

/**
 * Create a new season
 * @throws Error if start_date already exists (UNIQUE constraint)
 */
export async function createSeason(
	db: D1Database,
	input: CreateSeasonInput
): Promise<Season> {
	const id = nanoid();
	const now = new Date().toISOString();

	try {
		await db
			.prepare(
				'INSERT INTO seasons (id, name, start_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
			)
			.bind(id, input.name, input.start_date, now, now)
			.run();
	} catch (error) {
		// Check for UNIQUE constraint violation on start_date
		if (error instanceof Error && error.message.includes('UNIQUE')) {
			throw new Error(`Season with start date ${input.start_date} already exists`);
		}
		throw error;
	}

	return {
		id,
		name: input.name,
		start_date: input.start_date,
		created_at: now,
		updated_at: now
	};
}

/**
 * Get a season by ID
 */
export async function getSeason(
	db: D1Database,
	id: string
): Promise<Season | null> {
	return await db
		.prepare('SELECT id, name, start_date, created_at, updated_at FROM seasons WHERE id = ?')
		.bind(id)
		.first<Season>();
}

/**
 * Get all seasons ordered by start_date DESC (most recent first)
 */
export async function getAllSeasons(db: D1Database): Promise<Season[]> {
	const result = await db
		.prepare('SELECT id, name, start_date, created_at, updated_at FROM seasons ORDER BY start_date DESC')
		.all<Season>();

	return result.results;
}

/**
 * Find which season a given date falls into
 * A date belongs to the season with the largest start_date <= the given date
 */
export async function getSeasonByDate(
	db: D1Database,
	date: string // YYYY-MM-DD
): Promise<Season | null> {
	return await db
		.prepare(
			'SELECT id, name, start_date, created_at, updated_at FROM seasons WHERE start_date <= ? ORDER BY start_date DESC LIMIT 1'
		)
		.bind(date)
		.first<Season>();
}

/**
 * Get all events within a season's date range
 * A season's range is from its start_date to the day before the next season's start_date
 * (or unbounded if it's the most recent season)
 */
export async function getSeasonEvents(
	db: D1Database,
	seasonId: string
): Promise<Event[]> {
	// First get the season
	const season = await getSeason(db, seasonId);
	if (!season) {
		return [];
	}

	// Find the next season's start date (if any)
	const nextSeason = await db
		.prepare(
			'SELECT start_date FROM seasons WHERE start_date > ? ORDER BY start_date ASC LIMIT 1'
		)
		.bind(season.start_date)
		.first<{ start_date: string }>();

	// Build query based on whether there's a next season
	if (nextSeason) {
		// Events from this season's start to before next season's start
		const result = await db
			.prepare(
				`SELECT id, title, description, location, starts_at, ends_at, event_type, created_by, created_at 
				 FROM events 
				 WHERE DATE(starts_at) >= ? AND DATE(starts_at) < ?
				 ORDER BY starts_at ASC`
			)
			.bind(season.start_date, nextSeason.start_date)
			.all<Event>();

		return result.results;
	} else {
		// This is the most recent season - all events from start_date onwards
		const result = await db
			.prepare(
				`SELECT id, title, description, location, starts_at, ends_at, event_type, created_by, created_at 
				 FROM events 
				 WHERE DATE(starts_at) >= ?
				 ORDER BY starts_at ASC`
			)
			.bind(season.start_date)
			.all<Event>();

		return result.results;
	}
}

/**
 * Update a season
 * @throws Error if start_date already exists on another season
 */
export async function updateSeason(
	db: D1Database,
	id: string,
	input: UpdateSeasonInput
): Promise<Season | null> {
	const existing = await getSeason(db, id);
	if (!existing) {
		return null;
	}

	const updates: string[] = [];
	const values: (string | null)[] = [];

	if (input.name !== undefined) {
		updates.push('name = ?');
		values.push(input.name);
	}

	if (input.start_date !== undefined) {
		updates.push('start_date = ?');
		values.push(input.start_date);
	}

	if (updates.length === 0) {
		return existing;
	}

	updates.push('updated_at = ?');
	values.push(new Date().toISOString());
	values.push(id);

	try {
		await db
			.prepare(`UPDATE seasons SET ${updates.join(', ')} WHERE id = ?`)
			.bind(...values)
			.run();
	} catch (error) {
		if (error instanceof Error && error.message.includes('UNIQUE')) {
			throw new Error(`Season with start date ${input.start_date} already exists`);
		}
		throw error;
	}

	return await getSeason(db, id);
}

/**
 * Delete a season
 * @returns true if deleted, false if not found
 */
export async function deleteSeason(
	db: D1Database,
	id: string
): Promise<boolean> {
	const result = await db
		.prepare('DELETE FROM seasons WHERE id = ?')
		.bind(id)
		.run();

	return (result.meta.changes ?? 0) > 0;
}
