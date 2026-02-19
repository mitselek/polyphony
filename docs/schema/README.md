# Database Schema

Documentation for both Registry and Vault D1 databases (SQLite). Current state after migrations 0001-0043 (Schema V2).

## Module Files

- [registry.md](registry.md) - Registry Database (auth-only tables)
- [organizations.md](organizations.md) - Organizations (Schema V2)
- [members.md](members.md) - Core Entities (members, roles)
- [voices-sections.md](voices-sections.md) - Voices and Sections
- [library.md](library.md) - Score Library (works, editions, files)
- [inventory.md](inventory.md) - Physical Inventory (copies, assignments)
- [seasons.md](seasons.md) - Seasons and Repertoire
- [invitations.md](invitations.md) - Invitations
- [supporting.md](supporting.md) - Supporting Tables (sessions, takedowns, settings)
- [events.md](events.md) - Event Management (events, participation)
- [constraints.md](constraints.md) - Data Constraints (enum types)
- [migrations.md](migrations.md) - Migration History (0001-0043)

---

## Table Summary

| Category            | Tables                                                           |
| ------------------- | ---------------------------------------------------------------- |
| **Organizations**   | organizations, member_organizations, affiliations                |
| **Core**            | members, member_roles, member_preferences                        |
| **Voices/Sections** | voices, sections, member_voices, member_sections                 |
| **Score Library**   | works, editions, edition_sections, edition_files, edition_chunks |
| **Inventory**       | physical_copies, copy_assignments                                |
| **Seasons**         | seasons, season_works, season_work_editions                      |
| **Events**          | events, event_works, event_work_editions, participation          |
| **Invitations**     | invites, invite_voices, invite_sections                          |
| **Supporting**      | sessions, takedowns, vault_settings                              |

**Total: 26 tables** (after Schema V2 additions: organizations, member_organizations, affiliations, member_preferences)

---

## See Also

- [roles.md](../../apps/vault/docs/roles.md) - Role definitions and permissions
- [SCORE-LIBRARY-DESIGN.md](../SCORE-LIBRARY-DESIGN.md) - Score Library architecture
- [SCHEMA-V2-EVOLUTION.md](../SCHEMA-V2-EVOLUTION.md) - Schema V2 design rationale
- [UMBRELLA-ORGANIZATIONS.md](../UMBRELLA-ORGANIZATIONS.md) - Multi-organization feature design
- [migrations/](../../apps/vault/migrations/) - SQL migration files
- TypeScript interfaces: `../../apps/vault/src/lib/types.ts`
