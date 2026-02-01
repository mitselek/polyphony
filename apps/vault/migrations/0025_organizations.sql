-- Migration 0025: Add organizations table (Schema V2)
-- Part of Epic #158: Multi-Organization Implementation
-- Issue #159: Add organizations table migration

-- Organizations table: Core entity for multi-org support
-- - umbrella: Organization that contains other organizations (e.g., Estonian Choral Association)
-- - collective: Regular choir (most common, e.g., Kammerkoor Crede)
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('umbrella', 'collective')),
    contact_email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for subdomain lookups (used in routing)
CREATE INDEX IF NOT EXISTS idx_organizations_subdomain ON organizations(subdomain);

-- Seed Kammerkoor Crede as the first organization
-- ID is a fixed UUID for migration reproducibility
INSERT OR IGNORE INTO organizations (id, name, subdomain, type, contact_email)
VALUES (
    'org_crede_001',
    'Kammerkoor Crede',
    'crede',
    'collective',
    'info@crede.ee'
);
