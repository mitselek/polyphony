This specification outlines a federated, privacy-first ecosystem designed to empower musical communities (specifically choirs) to host and share scores without centralized paywalls.

The architecture prioritizes **legal insulation** by decoupling software authorship from content hosting and leveraging the EU "private circle" legal framework.

---

## 1. System Overview

The ecosystem consists of two primary entities:

1. **The Registry (Central Hub):** A curated, public-facing repository for verified Public Domain/Creative Commons works.
2. **The Vault (Private Nodes):** Independent, self-hosted instances for private choral rehearsals and trust-based peer sharing.

### Core Architectural Goals

* **Decentralization:** No single point of failure or legal liability for user-generated transcriptions.
* **Privacy by Design:** Peer-to-peer sharing requires an explicit "Handshake" (Mutual Trust).
* **Zero-Knowledge Hub:** The Central Hub never indexes or sees content within private Nodes.

---

## 2. High-Level Architecture

### A. The Registry (Central Hub)

* **Purpose:** Discovery, software distribution, and hosting "clean" content.
* **Key Services:**
* **Public Score API:** Serves validated MusicXML/PDFs.
* **Node Directory:** An opt-in list of public-facing choir profiles (Metadata only).
* **Identity Provider (Optional):** Supports OAuth2/OIDC for simplified cross-node authentication.



### B. The Vault (Node Software)

* **Purpose:** Personal/Choir score management and secure federation.
* **Key Services:**
* **Score Manager:** CRUD for `.mscz`, MusicXML, and PDF.
* **Federation Engine:** Manages the "Handshake" protocol and peer requests.
* **Web Renderer:** Interactive sheet music display (OSMD/Verovio).



---

## 3. The Trust Protocol (The Handshake)

To maintain the **Private Circle** legal status, sharing between nodes is not public. It follows an asynchronous Request-Response pattern:

1. **Discovery:** Node A finds Node B’s public identifier (URL/Public Key) via the Hub or direct exchange.
2. **Invite:** Node A sends a "Trust Request" to Node B.
3. **Handshake:** Node B’s admin approves. A secure relationship is established (e.g., via shared secrets or mutual JWT signing).
4. **Peer Access:** Users in Node A can now browse/request scores from Node B based on permission levels defined by Node B's owner.

---

## 4. Technical Stack Recommendations

| Layer | Recommended Technology | Reasoning |
| --- | --- | --- |
| **Backend** | Node.js (NestJS) or Go | High concurrency for file streaming; strong typing for protocol safety. |
| **Database** | PostgreSQL + Prisma | Relational integrity for complex permissions and metadata. |
| **Frontend** | React or Next.js | Component-based UI for complex music rendering. |
| **Music Rendering** | **OpenSheetMusicDisplay (OSMD)** | Best-in-class MusicXML rendering in the browser. |
| **File Storage** | S3-Compatible (Minio/Local) | Scalable; easy to self-host or use cheap cloud storage. |
| **Federation** | ActivityPub or Custom REST/mtls | ActivityPub is standard for social, but a custom mTLS approach is more "private." |

---

## 5. Data Model & Privacy Constraints

### Score Metadata

Scores must be tagged with a **Legal Status** enum:

* `ORIGINAL`: 100% User owned.
* `PUBLIC_DOMAIN`: Verified historical work.
* `PRIVATE_TRANSCRIPTION`: Only visible to the local node or trusted peers.

### Security Implementation

* **No Global Search:** The Hub **must not** crawl private nodes.
* **UUID Scoping:** All score assets served via signed, time-limited URLs to prevent leaked link sharing.
* **No Tracking:** Implementation of "Privacy Mode" (No telemetry, no third-party cookies).

---

## 6. Legal & Compliance Logic

As the architect, the software must enforce the following "Liability Shields":

* **Software Portability:** The code must be easy to deploy via Docker to ensure "Ownership" rests with the choir director, not the developer.
* **The Takedown Hook:** Each node must provide a simple `/abuse` or `/copyright` endpoint that allows the node admin to "unpublish" content instantly upon receipt of a notice.
