---
name: syncDocsWithArchitecture
description: Synchronize documentation across multiple files to align with architectural fundamentals.
argument-hint: List the core architectural principles that all documentation should reflect
---
Synchronize all documentation in the codebase to align with the specified architectural fundamentals.

## Task

1. **Identify documentation files** that may contain outdated or contradictory information (README, architecture docs, glossaries, contribution guides, code comments, etc.)

2. **Review each file** for terminology, diagrams, descriptions, and examples that contradict the stated fundamentals

3. **Update inconsistencies** including:
   - Diagrams showing outdated architecture
   - Terminology that doesn't match current model
   - Feature descriptions implying deprecated approaches
   - Roadmaps referencing old plans
   - Getting started guides with wrong workflows

4. **Add clarity where ambiguous** - If a term could be misunderstood, add explicit definitions distinguishing:
   - Infrastructure vs. data concepts
   - Shared vs. independent components
   - Current vs. future/deferred features

5. **Update deprecated terms tables** to guide contributors away from old terminology

6. **Verify no contradictions remain** by searching for outdated phrases across all docs

## Principles to Apply

${architectural fundamentals to enforce}

## Output

- List all files updated
- Summarize key changes per file
- Run tests to verify no regressions
- Commit with descriptive message referencing the architectural decision
