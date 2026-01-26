---
name: Refactor - Deduplicate Vault API Code
about: Remove duplicate auth/validation logic across API routes
title: 'refactor: Deduplicate Vault API routes authentication and validation'
labels: refactoring, technical-debt, vault
assignees: ''
---

## Problem

Significant code duplication exists across Vault API routes, leading to maintenance burden and inconsistency risk. Analysis shows ~200 lines of duplicate code across 10+ route handlers.

## Analysis

### 1. Duplicate Authentication Logic (6 occurrences)
**Current state**: Each route manually implements:
```typescript
const memberId = cookies.get('member_id');
const currentUser = await db.prepare(`
  SELECT GROUP_CONCAT(role) as roles
  FROM member_roles
  WHERE member_id = ?`).bind(memberId).first();
const roles = currentUser.roles?.split(',') ?? [];
```

**Files affected**:
- `src/routes/api/members/invite/+server.ts`
- `src/routes/api/members/[id]/+server.ts`
- `src/routes/api/members/[id]/roles/+server.ts`
- `src/routes/api/members/[id]/voice-part/+server.ts`
- `src/routes/invite/+page.server.ts`
- Additional routes

**Solution**: Use existing `getAuthenticatedMember()` from `lib/server/auth/middleware.ts`

### 2. Unused API Handler Library
**File**: `src/lib/server/api/invites.ts` (49 lines)
- Created during refactoring but never used by routes
- Routes implement their own logic instead
- Should be deleted or routes should be refactored to use it

### 3. Permission Check Duplication
**Current state**: Manual role checking in each route:
```typescript
const isAdmin = roles.some(r => ['admin', 'owner'].includes(r));
if (!isAdmin) throw error(403, 'Admin or owner role required');
```

**Solution**: Use `requireRole()` helper from permissions system

### 4. No Request Validation
- JSON parsing duplicated everywhere
- No shared validation schemas
- Inconsistent error messages

## Tasks

### Phase 1: Remove Dead Code ✅ Low-hanging fruit
- [ ] Delete `src/lib/server/api/invites.ts` (unused invite handler)
- [ ] Verify tests still pass after deletion

### Phase 2: Consolidate Auth Middleware 🔧 High impact
- [ ] Refactor `src/routes/api/members/invite/+server.ts` to use `getAuthenticatedMember()`
- [ ] Refactor `src/routes/api/members/[id]/+server.ts` to use middleware
- [ ] Refactor `src/routes/api/members/[id]/roles/+server.ts` to use middleware
- [ ] Refactor `src/routes/api/members/[id]/voice-part/+server.ts` to use middleware
- [ ] Refactor remaining routes with auth logic
- [ ] Run tests after each refactor

### Phase 3: Add Shared Validation 📋 Future-proofing
- [ ] Add Zod as dependency
- [ ] Create validation schemas in `src/lib/server/validation/`:
  - `inviteSchema` - validate invite creation requests
  - `roleUpdateSchema` - validate role changes
  - `voicePartSchema` - validate voice part updates
- [ ] Update routes to use schemas
- [ ] Add validation tests

### Phase 4: Extract Permission Helpers 🔒 Consistency
- [ ] Create `src/lib/server/auth/helpers.ts` with:
  - `requireAdmin(member)` - throw if not admin/owner
  - `requireOwner(member)` - throw if not owner
  - `requireAnyRole(member, roles)` - throw if missing roles
- [ ] Update all routes to use helpers
- [ ] Remove duplicate permission checks

## Success Criteria

- [ ] Routes use shared auth middleware (no duplicate `GROUP_CONCAT` queries)
- [ ] No unused API handler files
- [ ] Request validation centralized with Zod schemas
- [ ] Permission checks use shared helpers
- [ ] All 184 tests still pass
- [ ] Code reduced by ~200 lines

## Benefits

1. **Maintainability**: Change auth logic once, applies everywhere
2. **Type Safety**: Zod provides runtime type validation + TypeScript inference
3. **Consistency**: Same error messages, validation rules across all endpoints
4. **Testability**: Easier to test shared functions than scattered logic
5. **Debugging**: Single source of truth for auth/validation

## Related Issues

- Original multi-role implementation (introduced duplication during rapid development)
- TypeScript validation gap (issue #TBD - why duplicates weren't caught)

## Notes

- Discovered during post-deployment review after making roles optional
- TypeScript didn't catch duplicate validation because it's runtime checks, not type constraints
- This is technical debt from Phase 1 rapid development - normal to clean up now

## Estimated Effort

- Phase 1: 30 min (delete file, run tests)
- Phase 2: 2-3 hours (refactor routes one by one)
- Phase 3: 1-2 hours (add Zod, create schemas)
- Phase 4: 1 hour (extract helpers)

**Total: ~5-7 hours** spread across multiple PRs

## Priority

**Medium** - Not blocking features, but reduces maintenance burden and prevents future inconsistencies.
