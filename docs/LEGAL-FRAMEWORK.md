# Polyphony Legal Framework

This document outlines the legal architecture designed to minimize liability while enabling choral communities to share music.

> **Terminology**: See [GLOSSARY.md](GLOSSARY.md) for definitions.

---

## 1. Design Principles

### 1.1 Liability Isolation

The architecture separates concerns to isolate legal exposure:

```text
┌─────────────────────────────────────────────────────────┐
│                      REGISTRY                           │
│  Liability: Low                                         │
│  • Does NOT host score files                            │
│  • Only links to content in Vaults                      │
│  • Provides neutral tools (deployment, discovery)       │
└─────────────────────────────────────────────────────────┘
                          │
                    introduces
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                       VAULTS                            │
│  Liability: With Vault Owner                            │
│  • Vault Owner is the "service provider"                │
│  • Owner responsible for content they host              │
│  • P2P sharing = bilateral agreement between Vaults     │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Key Legal Doctrines

| Doctrine                           | Jurisdiction         | How We Apply It                    |
| ---------------------------------- | -------------------- | ---------------------------------- |
| **Private Circle Exemption**       | EU (varies by state) | P2P sharing between trusted Vaults |
| **Safe Harbor / Hosting Immunity** | EU DSA, US DMCA      | Registry as neutral platform       |
| **Notice and Action**              | EU DSA               | Takedown mechanism on every Vault  |

---

## 2. The Private Circle Defense

### 2.1 Legal Basis

EU copyright law (Directive 2001/29/EC, Art. 5.2) permits reproduction for "private use" within a "family circle or equivalent."

**Our interpretation**: A choir sharing rehearsal materials among its members constitutes a "private circle" analogous to family.

**Federation extension**: When two choirs establish a Handshake, they form an extended private circle based on mutual trust and shared purpose (choral practice).

### 2.2 Requirements for Private Circle Status

To maintain the defense, the following must be true:

| Requirement                | Implementation                                            |
| -------------------------- | --------------------------------------------------------- |
| **Closed group**           | Vault membership is invite-only, approved by Vault Owner  |
| **Personal relationships** | Members share a common purpose (the choir)                |
| **No commercial purpose**  | Polyphony is non-commercial; Vaults are for rehearsal use |
| **Limited scale**          | Handshakes are bilateral; no mass distribution            |

### 2.3 What Breaks Private Circle

The defense **fails** if:

- ❌ Content is made publicly accessible (no authentication)
- ❌ Sharing happens with strangers (no established relationship)
- ❌ Commercial transactions are involved
- ❌ Scale becomes "public" (thousands of unrelated users)

### 2.4 Open Questions

> See [CONCERNS.md](CONCERNS.md) § 1.1 for unresolved questions about Private Circle validity.

- At what scale does a network of Handshakes become "public"?
- Does cross-border federation affect the analysis?
- What documentation proves Private Circle status if challenged?

---

## 3. Registry Liability Shield

### 3.1 Position: Neutral Tool Provider

Registry operates as a **neutral platform** providing:

1. **Deployment service**: Technical tool to create Vaults
2. **Discovery service**: Directory of Vaults (opt-in)
3. **PD Catalog**: Index of links to Public Domain scores (hosted in Vaults)

Registry does **NOT**:

- Host copyrighted content
- Control what Vaults store
- Participate in P2P score sharing
- Verify content beyond PD catalog entries

### 3.2 Safe Harbor Requirements (EU DSA)

To maintain hosting immunity under the Digital Services Act:

| Requirement                     | Implementation                                 |
| ------------------------------- | ---------------------------------------------- |
| **No actual knowledge**         | Registry doesn't inspect Vault contents        |
| **Act expeditiously on notice** | Delist PD catalog entries upon valid complaint |
| **Provide notice mechanism**    | Public contact for copyright concerns          |
| **Transparency**                | Publish content policy and moderation actions  |

### 3.3 PD Catalog Liability

The PD Catalog links to scores that Vault Owners claim are Public Domain.

**Risk**: A Vault Owner incorrectly marks a copyrighted work as PD.

**Mitigation**:

1. Registry relies on Vault Owner's attestation (good faith)
2. Registry removes link immediately upon notice
3. Registry does not make independent PD determinations (no editorial control)
4. Terms of Service place burden of proof on Vault Owner

### 3.4 Takedown Flow (Registry)

```text
1. Complainant submits notice to Registry
   └─→ Required: Work identification, ownership proof, contact info

2. Registry evaluates notice validity (formal check only)
   └─→ NOT a determination of copyright status

3. If valid notice:
   └─→ Remove link from PD Catalog within 24 hours
   └─→ Notify affected Vault Owner
   └─→ Log action for transparency report

4. Vault Owner may counter-notify
   └─→ Registry restores link after 14 days unless legal action filed
```

---

## 4. Vault Liability

### 4.1 Position: Service Provider

Each Vault Owner operates as an independent "service provider" under EU law. They are responsible for:

- Content uploaded to their Vault
- Access control decisions
- Responding to takedown requests
- Ensuring members understand usage terms

### 4.2 Content Categories & Risk

| Category                  | Risk Level | Who Can Access      | Registry Lists?           |
| ------------------------- | ---------- | ------------------- | ------------------------- |
| **Public Domain**         | Low        | Anyone (if shared)  | Yes (via PD Catalog)      |
| **Creative Commons**      | Low        | Per license terms   | Yes (if CC-BY or similar) |
| **Original Work**         | Low        | Vault Owner decides | Optional                  |
| **Private Transcription** | Medium     | Trusted Vaults only | **Never**                 |

### 4.3 Private Transcription Rules

Private Transcriptions are user-created scores of copyrighted works. These are the highest-risk content.

**Technical enforcement**:

1. Transcriptions are flagged in metadata
2. Flag blocks listing in Registry PD Catalog
3. Flag restricts sharing to Handshake-only
4. UI warns user about Private Circle requirements

**Legal positioning**:

- Vault Owner assumes risk for hosting
- Sharing relies on Private Circle defense
- If challenged, Vault Owner must defend or remove

### 4.4 Takedown Flow (Vault)

Every Vault must implement:

```text
1. Public /copyright or /abuse endpoint
   └─→ Accessible without authentication

2. Vault Owner receives notification
   └─→ Email + in-app alert

3. Vault Owner evaluates and responds
   └─→ Remove content, OR
   └─→ Counter-notify with justification

4. Log all actions
   └─→ For potential legal defense
```

---

## 5. Software Author Liability

### 5.1 Position: Tool Maker

Polyphony software is a neutral tool, like a word processor or web server. The authors:

- Do not control what users store
- Do not participate in content decisions
- Do not receive revenue from infringement

### 5.2 Protections

| Protection                         | Implementation                                      |
| ---------------------------------- | --------------------------------------------------- |
| **Open source**                    | Code is public; no secrets                          |
| **No central control**             | Vaults are independently operated                   |
| **Terms of Service**               | Users agree not to infringe                         |
| **Substantial non-infringing use** | PD/CC content, original works, legal transcriptions |

### 5.3 Design Choices for Legal Safety

The architecture includes deliberate choices to avoid "inducement" liability:

- ✅ Federation requires explicit Handshake (no passive sharing)
- ✅ No global search of private content
- ✅ No anonymization features that facilitate infringement
- ✅ Built-in takedown mechanisms
- ✅ Content warnings for Private Transcriptions

---

## 6. Compliance Checklist

### 6.1 Registry Must

- [ ] Publish Terms of Service and Privacy Policy
- [ ] Provide public copyright contact
- [ ] Implement PD Catalog delisting mechanism
- [ ] Keep transparency log of moderation actions
- [ ] Not inspect or index Vault private content

### 6.2 Vault Software Must

- [ ] Require authentication for all content access
- [ ] Implement /copyright takedown endpoint
- [ ] Allow content flagging (PD, CC, Original, Transcription)
- [ ] Block Transcriptions from Registry listing
- [ ] Log access for audit purposes
- [ ] Warn users about Private Circle requirements

### 6.3 Vault Owner Must

- [ ] Verify PD status before listing in Registry
- [ ] Respond to takedown notices promptly
- [ ] Maintain member list (for Private Circle defense)
- [ ] Accept Terms of Service acknowledging liability

---

## 7. Jurisdictional Considerations

### 7.1 Primary Jurisdiction: EU

Design is based on EU law because:

- Target users are European choirs
- EU has explicit Private Circle framework
- DSA provides clear Safe Harbor rules

### 7.2 US Exposure

If US users participate:

- DMCA Safe Harbor requires registered DMCA agent
- No Private Circle equivalent (fair use is narrower)
- Consider geo-blocking or explicit US terms

### 7.3 Cross-Border Federation

When Vault A (Estonia) shares with Vault B (Germany):

- Which law applies?
- Current assumption: Law of content host (Vault A)
- **Needs legal review**

---

## 8. Risk Assessment

| Scenario                                      | Likelihood | Impact | Mitigation                                     |
| --------------------------------------------- | ---------- | ------ | ---------------------------------------------- |
| Rights holder complains about PD Catalog link | Medium     | Low    | Delist promptly; no content hosted             |
| Rights holder complains about Vault content   | Medium     | Medium | Vault Owner handles; not Registry's liability  |
| Challenge to Private Circle defense           | Low        | High   | Document membership, require legal review      |
| Software author sued for inducement           | Very Low   | High   | Open source, substantial lawful use, no profit |
| Mass DMCA/DSA takedowns                       | Low        | Medium | Rate limit, require verified notices           |

---

## 9. Recommended Actions Before Launch

1. **Legal review**: Engage EU copyright attorney to validate Private Circle interpretation
2. **Entity structure**: Decide if Registry needs non-profit status
3. **Terms of Service**: Draft ToS for Registry and Vault template
4. **DMCA agent**: Register if US users allowed
5. **Insurance**: Consider errors & omissions coverage for Registry operator

---

## 10. References

- [EU Copyright Directive 2001/29/EC](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A32001L0029) - Art. 5.2 (private copying)
- [Digital Services Act (DSA)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2065) - Hosting provider obligations
- [DMCA § 512](https://www.law.cornell.edu/uscode/text/17/512) - US Safe Harbor (if applicable)

---

_Last updated: 2026-01-23_
