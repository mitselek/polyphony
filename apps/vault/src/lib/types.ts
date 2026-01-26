// Shared types for the vault application
// These types are used across both server and client code

export type Role = 'owner' | 'admin' | 'librarian' | 'conductor' | 'section_leader';

// All assignable roles (used in members list and invite form)
export const ASSIGNABLE_ROLES = ['owner', 'admin', 'librarian', 'conductor', 'section_leader'] as const;

export type EventType = 'rehearsal' | 'concert' | 'retreat';

// ============================================================================
// VOICES & SECTIONS SYSTEM
// ============================================================================

/**
 * Voice: Vocal capability (what you CAN sing)
 * Example: Thomas can sing Tenor OR Baritone
 */
export interface Voice {
	id: string;
	name: string;
	abbreviation: string;
	category: 'vocal' | 'instrumental';
	rangeGroup: string | null;
	displayOrder: number;
	isActive: boolean;
}

/**
 * Section: Performance assignment (where you DO sing)
 * Example: Thomas performs in Tenor 2
 */
export interface Section {
	id: string;
	name: string;
	abbreviation: string;
	parentSectionId: string | null;
	displayOrder: number;
	isActive: boolean;
}

/**
 * Member voice assignment (junction table)
 */
export interface MemberVoice {
	memberId: string;
	voiceId: string;
	isPrimary: boolean;
	assignedAt: string;
	assignedBy: string | null;
	notes: string | null;
}

/**
 * Member section assignment (junction table)
 */
export interface MemberSection {
	memberId: string;
	sectionId: string;
	isPrimary: boolean;
	joinedAt: string;
	assignedBy: string | null;
	notes: string | null;
}

/**
 * Invite voice assignment (junction table)
 */
export interface InviteVoice {
	inviteId: string;
	voiceId: string;
	isPrimary: boolean;
}

/**
 * Invite section assignment (junction table)
 */
export interface InviteSection {
	inviteId: string;
	sectionId: string;
	isPrimary: boolean;
}

/**
 * Input for creating a new voice
 */
export interface CreateVoiceInput {
	name: string;
	abbreviation: string;
	category: 'vocal' | 'instrumental';
	rangeGroup?: string;
	displayOrder: number;
	isActive?: boolean;
}

/**
 * Input for creating a new section
 */
export interface CreateSectionInput {
	name: string;
	abbreviation: string;
	parentSectionId?: string;
	displayOrder: number;
	isActive?: boolean;
}
