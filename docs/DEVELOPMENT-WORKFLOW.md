# Polyphony Development Workflow

## Pre-Commit Checklist

Before committing code, **always** run:

```bash
# 1. Type check (catches signature mismatches, type errors)
pnpm check

# 2. Run tests (ensures functionality works)
pnpm test

# 3. Only commit if both pass
git commit
```

## Automated Checks

### Git Hook (Recommended)

Configure git to use the pre-commit hook:

```bash
git config core.hooksPath .githooks
```

This will automatically run type checks and tests before each commit.

### GitHub Actions (CI)

Pull requests and pushes trigger automated CI that runs:
- `pnpm check` - TypeScript type validation across all packages
- `pnpm test` - All unit tests (shared, registry, vault)

## Why Both Commands?

- **`pnpm test`**: Runs unit tests with mocks. Tests can pass even if real code has type errors.
- **`pnpm check`**: Runs TypeScript compiler and svelte-check. Catches interface mismatches, missing parameters, invalid types.

**Example of what tests miss:**
```typescript
// Real code:
function acceptInvite(db, token, email, name?) { ... }

// Test mock (correct signature):
acceptInvite: vi.fn() // Can be called with any args

// Broken wrapper:
acceptInvite(db, token) // Missing email - test passes! ✅

// Type check:
acceptInvite(db, token) // ERROR: Expected 3-4 args ❌
```

## Post-Merge Validation

After pulling changes:

```bash
pnpm install  # Update dependencies
pnpm check    # Verify no type errors
pnpm test     # Verify tests still pass
```

## Error: "Tests pass but types fail"

This happened in commit [reference]: Tests passed with 184/184 ✅, but `pnpm check` found 2 type errors ❌.

**Root cause**: Unit test mocks don't enforce real function signatures.

**Solution**: Always run BOTH `pnpm test` AND `pnpm check` before committing.

## Quick Reference

```bash
# Development
pnpm dev              # Start dev server (registry)
cd apps/vault && pnpm dev  # Start vault dev server

# Quality checks
pnpm check            # Type safety
pnpm test             # Unit tests
pnpm run test:unit    # Watch mode

# Before commit
git config core.hooksPath .githooks  # Enable pre-commit hook (one-time)
# Hook automatically runs check + test
```
