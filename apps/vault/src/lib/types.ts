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

// ============================================================================
// PARTICIPATION SYSTEM
// ============================================================================

export type PlannedStatus = 'yes' | 'no' | 'maybe' | 'late';
export type ActualStatus = 'present' | 'absent' | 'late';

/**
 * Participation record for an event
 */
export interface Participation {
	id: string;
	memberId: string;
	eventId: string;

	// RSVP (member sets)
	plannedStatus: PlannedStatus | null;
	plannedAt: string | null;
	plannedNotes: string | null;

	// Actual attendance (conductor records)
	actualStatus: ActualStatus | null;
	recordedAt: string | null;
	recordedBy: string | null;

	createdAt: string;
	updatedAt: string;
}

/**
 * Input for creating participation record
 */
export interface CreateParticipationInput {
	memberId: string;
	eventId: string;
	plannedStatus?: PlannedStatus;
	plannedNotes?: string;
}

/**
 * Input for updating participation (RSVP or recording attendance)
 * Use null to clear a status, undefined to leave unchanged
 */
export interface UpdateParticipationInput {
	plannedStatus?: PlannedStatus | null;
	plannedNotes?: string | null;
	actualStatus?: ActualStatus | null;
	recordedBy?: string;
}

/**
 * Summary statistics for an event
 */
export interface ParticipationSummary {
	eventId: string;
	totalMembers: number;

	// Planned counts
	plannedYes: number;
	plannedNo: number;
	plannedMaybe: number;
	plannedLate: number;
	noResponse: number;

	// Actual counts (if event is past)
	actualPresent: number;
	actualAbsent: number;
	actualLate: number;
	notRecorded: number;
}

// ============================================================================
// ROSTER VIEW SYSTEM
// ============================================================================

/**
 * Complete roster view for display
 */
export interface RosterView {
	events: RosterEvent[];
	members: RosterMember[];
	summary: RosterSummary;
}

/**
 * Event with participation data
 */
export interface RosterEvent {
	id: string;
	name: string;
	date: string;
	type: EventType;
	participation: Map<string, ParticipationStatus>; // memberId -> status
}

/**
 * Member with section and voice info for roster
 */
export interface RosterMember {
	id: string;
	name: string;
	nickname: string | null; // Optional compact display name
	email: string | null; // OAuth email_id (null for roster-only members)
	primarySection: Section | null;
	allSections: Section[];
	primaryVoice: Voice | null;
}

/**
 * Participation status for a single member/event combo
 */
export interface ParticipationStatus {
	plannedStatus: PlannedStatus | null;
	actualStatus: ActualStatus | null;
	recordedAt: string | null;
}

/**
 * Summary statistics for roster view
 */
export interface RosterSummary {
	totalEvents: number;
	totalMembers: number;
	averageAttendance: number; // Percentage
	sectionStats: Record<string, SectionSummaryStats>; // sectionId -> stats
}

/**
 * Section-based summary statistics (Epic #73)
 */
export interface SectionSummaryStats {
	sectionName: string;
	sectionAbbr: string;
	total: number; // Total members in section
	yes: number; // Planned 'yes' across all upcoming events
	no: number;
	maybe: number;
	late: number;
	responded: number; // Total who responded (yes + no + maybe + late)
}

/**
 * Filters for roster view query
 */
export interface RosterViewFilters {
	start?: string; // ISO datetime
	end?: string; // ISO datetime
	sectionId?: string; // Filter members by section
}
