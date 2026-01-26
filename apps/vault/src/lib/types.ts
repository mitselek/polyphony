// Shared types for the vault application
// These types are used across both server and client code

export type Role = 'owner' | 'admin' | 'librarian' | 'conductor';
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
