// Shared types for the vault application
// These types are used across both server and client code

export type Role = 'owner' | 'admin' | 'librarian' | 'conductor' | 'section_leader';

// All assignable roles (used in members list and invite form)
export const ASSIGNABLE_ROLES = ['owner', 'admin', 'librarian', 'conductor', 'section_leader'] as const;

export type VoicePart =
	| 'S'
	| 'A'
	| 'T'
	| 'B'
	| 'SA'
	| 'AT'
	| 'TB'
	| 'SAT'
	| 'ATB'
	| 'SATB';
export type EventType = 'rehearsal' | 'concert' | 'retreat';
