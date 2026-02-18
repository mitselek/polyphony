# Claude Code Team Configuration

Shared team configurations for Claude Code multi-agent sessions on Polyphony.

## Available Teams

| Team            | Description                                                                   |
| --------------- | ----------------------------------------------------------------------------- |
| `polyphony-dev` | Full development team (frontend, backend, testing, i18n, architecture review) |

## Setup

1. Copy the team JSON to your local Claude teams directory:

   ```bash
   mkdir -p ~/.claude/teams/polyphony-dev
   cp .claude/teams/polyphony-dev.json ~/.claude/teams/polyphony-dev/config.json
   ```

2. Start a session with the team:

   ```bash
   claude --team polyphony-dev
   ```

## Team Members

| Name          | Model      | Role                                              |
| ------------- | ---------- | ------------------------------------------------- |
| **team-lead** | Sonnet 4.6 | Task coordination, product owner liaison          |
| **sven**      | Opus 4.6   | Svelte 5 frontend, components, CSS, accessibility |
| **dag**       | Opus 4.6   | D1 database, migrations, API endpoints, auth      |
| **tess**      | Opus 4.6   | TDD, Vitest unit tests, Playwright E2E            |
| **lingo**     | Sonnet 4.6 | i18n (Paraglide), translations (en/et/lv/uk)      |
| **arvo**      | Opus 4.6   | Architecture review, code quality, refactoring    |

## Workflow

1. **team-lead** breaks work into tasks and assigns to specialists
2. **tess** writes failing tests first (TDD red phase)
3. **sven** / **dag** implement (green phase)
4. **lingo** adds i18n for new UI strings
5. **arvo** reviews code (RED/YELLOW/GREEN) before commit
6. Quality gates: `pnpm check` + `pnpm test` must pass
