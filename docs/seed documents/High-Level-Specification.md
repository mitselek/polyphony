# High-Level Specification: Federated Choral Score Ecosystem

## 1. Project Vision
To create a decentralized, legally resilient platform for choral music sharing. This ecosystem replaces centralized, paywalled services with a two-tier architecture: a public hub for verified legal content and private, self-hosted nodes for community-based sharing.

---

## 2. System Architecture

### 2.1 The Registry (Central Hub)
The Registry acts as the ecosystem's "Public Square."
- **Content:** Only verified Public Domain (PD) or Creative Commons (CC) works.
- **Responsibility:** Managed by the core project team.
- **Key Features:**
    - Public Score Repository (Searchable/Indexable).
    - Node Software Distribution (Docker images, setup scripts).
    - Optional Node Discovery Service (Opt-in directory of active choir instances).

### 2.2 The Vault (The Node)
The Vault is a self-hosted instance (one per choir/user).
- **Content:** Internal scores, rehearsal transcriptions, and peer-shared files.
- **Responsibility:** Managed by the individual choir director/admin.
- **Key Features:**
    - **Score Management:** Support for `.mscz`, MusicXML, MIDI, and PDF.
    - **Interactive Player:** Browser-based rendering (no local software required for members).
    - **Access Control:** Mandatory authentication (OAuth2/OIDC).
    - **Federation Module:** The "Handshake" engine for P2P sharing.

---

## 3. The Trust Protocol (Handshake)
To maintain the "Private Circle" legal status, sharing between independent nodes must be intentional and authenticated.

1. **Discovery:** Admin A provides a unique "Node URI" or Public Key to Admin B.
2. **Request:** Node A initiates a "Trust Handshake" with Node B.
3. **Approval:** Admin B reviews the request. Upon approval, a mutual cryptographic trust is established (signed JWTs or mTLS).
4. **Peer Sync:** Users of Node A can now see "Shared" categories from Node B. Files are streamed directly between nodes; the Central Hub is never involved.

---

## 4. Technical Stack Recommendations

### Backend
- **Framework:** Node.js (NestJS) or Go (Golang).
- **API:** GraphQL (for complex score metadata) or REST.
- **Authentication:** Keycloak or Authelia (for self-hosting) or a simple internal OAuth2 provider.

### Frontend
- **Framework:** Next.js (React).
- **Music Notation Engine:** [OpenSheetMusicDisplay (OSMD)](https://opensheetmusicdisplay.org/) for rendering MusicXML.
- **State Management:** TanStack Query (React Query) for handling federated data fetching.

### Infrastructure (The Node)
- **Deployment:** Docker & Docker Compose.
- **Storage:** S3-compatible (MinIO for self-hosting or Cloudflare R2 for low-cost cloud).
- **Database:** PostgreSQL (with Prisma ORM).

---

## 5. Data Schema & Legal Logic

### Score Metadata (Core Object)
```json
{
  "id": "UUID",
  "title": "String",
  "composer": "String",
  "licenseType": "Enum[PUBLIC_DOMAIN, ORIGINAL, TRANSCRIPTION]",
  "visibility": "Enum[PRIVATE, SHARED_WITH_TRUSTED, PUBLIC_HUB]",
  "isManualTranscription": "Boolean",
  "hash": "SHA-256" 
}

```

### Liability Shield Implementation

* **Isolation:** Each node maintains its own database.
* **No Global Search:** The Central Hub does not index files marked as `TRANSCRIPTION`.
* **User Redress:** Built-in "Takedown" interface on every node to comply with DSA "Notice and Action" requirements.

---

## 6. Development Roadmap

1. **Phase 1:** Build the standalone "Vault" (Node) software.
2. **Phase 2:** Implement the interactive sheet music viewer.
3. **Phase 3:** Develop the Peer-to-Peer Handshake Protocol.
4. **Phase 4:** Launch the Central Hub for Public Domain curation.
