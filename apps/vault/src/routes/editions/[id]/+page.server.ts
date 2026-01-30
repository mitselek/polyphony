import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getMemberById, getAllMembers, type Member } from '$lib/server/db/members';
import { getEditionById } from '$lib/server/db/editions';
import { getWorkById } from '$lib/server/db/works';
import { getAllSections } from '$lib/server/db/sections';
import { canUploadScores } from '$lib/server/auth/permissions';
import { getPhysicalCopiesByEdition } from '$lib/server/db/physical-copies';
import { getActiveAssignments } from '$lib/server/db/copy-assignments';

interface CopyWithAssignment {
	id: string;
	copyNumber: string;
	condition: string;
	assignment: {
		memberId: string;
		memberName: string;
		assignedAt: string;
	} | null;
}

interface MemberForAssignment {
	id: string;
	name: string;
	nickname: string | null;
	primarySection: { id: string; name: string; displayOrder: number } | null;
}

async function loadCopiesWithAssignments(
	db: D1Database,
	editionId: string
): Promise<CopyWithAssignment[]> {
	const copies = await getPhysicalCopiesByEdition(db, editionId);
	const members = await getAllMembers(db);
	const memberMap = new Map(members.map((m) => [m.id, m.name]));

	const copiesWithAssignments: CopyWithAssignment[] = [];

	for (const copy of copies) {
		const activeAssignments = await getActiveAssignments(db, copy.id);
		const assignment = activeAssignments[0]; // Should only be one active

		copiesWithAssignments.push({
			id: copy.id,
			copyNumber: copy.copyNumber,
			condition: copy.condition,
			assignment: assignment
				? {
						memberId: assignment.memberId,
						memberName: memberMap.get(assignment.memberId) ?? 'Unknown',
						assignedAt: assignment.assignedAt
					}
				: null
		});
	}

	return copiesWithAssignments;
}

async function checkCanManage(db: D1Database, memberId: string | undefined): Promise<boolean> {
	if (!memberId) return false;
	const member = await getMemberById(db, memberId);
	return member ? canUploadScores(member) : false;
}

async function loadLibrarianData(db: D1Database, editionId: string, canManage: boolean) {
	if (!canManage) {
		return { copies: [] as CopyWithAssignment[], members: [] as MemberForAssignment[] };
	}
	const [copies, members] = await Promise.all([
		loadCopiesWithAssignments(db, editionId),
		getAllMembers(db)
	]);
	// Transform members for assignment dropdown with section info
	const membersForAssignment: MemberForAssignment[] = members.map((m) => ({
		id: m.id,
		name: m.name,
		nickname: m.nickname,
		primarySection: m.sections[0] ? {
			id: m.sections[0].id,
			name: m.sections[0].name,
			displayOrder: m.sections[0].displayOrder
		} : null
	}));
	return { copies, members: membersForAssignment };
}

export const load: PageServerLoad = async ({ params, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const edition = await getEditionById(db, params.id);
	if (!edition) throw error(404, 'Edition not found');

	const work = await getWorkById(db, edition.workId);
	if (!work) throw error(404, 'Work not found');

	const canManage = await checkCanManage(db, cookies.get('member_id'));

	const [sections, librarianData] = await Promise.all([
		getAllSections(db),
		loadLibrarianData(db, params.id, canManage)
	]);

	return {
		edition,
		work,
		sections,
		canManage,
		copies: librarianData.copies,
		members: librarianData.members
	};
};
