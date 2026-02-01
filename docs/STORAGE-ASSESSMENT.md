# Cloudflare Storage Assessment

Evaluation of Cloudflare storage options for Polyphony.

**Last Updated**: 2026-02-01

---

## Current Architecture

**D1 (SQLite)** for everything:

- Relational data (members, events, organizations)
- Score files (chunked to work around 2MB row limit)

---

## Available Options

| Product             | Type             | Best For                 | Limits                    | Pricing      |
| ------------------- | ---------------- | ------------------------ | ------------------------- | ------------ |
| **D1**              | SQL (SQLite)     | Relational data, queries | 10GB/db, 2MB row          | $0.75/GB-mo  |
| **R2**              | Object storage   | Large files, blobs       | Unlimited                 | $0.015/GB-mo |
| **KV**              | Key-value        | Config, sessions, cache  | 25MB value, 1 write/s/key | $0.50/GB-mo  |
| **Durable Objects** | Stateful compute | Real-time, coordination  | 1GB SQLite/object         | Per-request  |

---

## Assessment for Polyphony

### D1 - ✅ Keep for relational data

**Strengths**:

- SQL queries, JOINs, transactions
- Familiar SQLite semantics
- Migration support
- Time Travel (30-day point-in-time recovery)
- 10GB per database (sufficient for metadata)
- Works on Free tier

**Limitations**:

- 2MB row size limit (handled with chunking)
- 9.5MB max file size (5 chunks × ~1.9MB)
- Higher storage cost for binary data

**Use for**: Members, events, organizations, subscriptions, invites, metadata.

### R2 - 🤔 Future consideration for files

**Strengths**:

- **No egress fees** (significant for downloads)
- Unlimited file sizes
- S3-compatible API
- $0.015/GB-mo (50x cheaper than D1 for storage)
- No chunking needed

**Limitations**:

- Requires Workers Paid plan ($5/mo minimum)
- No SQL queries (separate lookup required)
- Additional service to manage

**Use for**: Score PDFs (future migration).

### KV - ❌ Not needed

**Why not**:

- Eventually consistent (not suitable for our data)
- 1 write/s/key limit
- No queries
- We don't have a caching use case

### Durable Objects - ❌ Overkill

**Why not**:

- Designed for real-time coordination (chat, games)
- More complex architecture
- We don't need per-object compute
- D1 is built on Durable Objects anyway

---

## Cost Comparison: D1 vs R2 for Files

Assuming 100 vaults with average 500MB of score files each (50GB total):

| Storage      | D1 Chunked                | R2                        |
| ------------ | ------------------------- | ------------------------- |
| Monthly cost | 50GB × $0.75 = **$37.50** | 50GB × $0.015 = **$0.75** |
| Complexity   | Chunking logic            | Direct upload/download    |
| Size limit   | 9.5MB per file            | Unlimited                 |
| Egress       | Included in D1            | **No egress fees**        |

**R2 is 50x cheaper for file storage.**

---

## Recommendation

### Current (Pre-revenue): D1 Only

- ✅ Simpler architecture
- ✅ Works on Free tier
- ✅ Chunking handles current needs
- ✅ No additional billing complexity

### Future (Post-revenue): Hybrid D1 + R2

When paying customers cover $5/mo Workers Paid plan:

| Data Type             | Storage | Reason                      |
| --------------------- | ------- | --------------------------- |
| Relational data       | D1      | SQL queries, transactions   |
| Score files           | R2      | 50x cheaper, no size limits |
| Umbrella shared files | R2      | Same benefits               |

**Migration tasks**:

1. Create R2 bucket
2. Write migration script (D1 chunks → R2)
3. Update edition-storage.ts
4. Remove chunking code

---

## Decision Log

| Date       | Decision                   | Rationale                                  |
| ---------- | -------------------------- | ------------------------------------------ |
| 2026-01-XX | Use D1 chunked storage     | Avoid R2 requirement, stay on Free tier    |
| 2026-02-01 | Keep D1, plan R2 migration | Wait for paying customers to justify $5/mo |

---

## Related Documents

- [ROADMAP.md](ROADMAP.md) - R2 migration in Future Phases
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [edition-storage.ts](../apps/vault/src/lib/server/storage/edition-storage.ts) - Current chunked storage

---

_Last updated: 2026-02-01_
