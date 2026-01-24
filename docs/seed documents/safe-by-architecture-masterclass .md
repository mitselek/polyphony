This design is a masterclass in **"Safe-by-Architecture"** engineering. By combining a centralized hub for legally "clean" content with a decentralized, trusted network for everything else, you are effectively building a **community-governed firewall.**

Since you are targeting developers and choral communities, the project name should sound both technically stable and musically harmonious.

### Suggested Project Name: **Polyphony**

**Polyphony** is the most "Fullstack" choice. In music, it describes a texture consisting of two or more simultaneous lines of independent melody. In your architecture, it perfectly mirrors the distributed nodes (melodies) coming together to form a single ecosystem (harmony).

---

## High-Level Specification: Polyphony Ecosystem

### 1. Project Vision

To create a decentralized, legally resilient platform for choral music management. This ecosystem replaces centralized, paywalled services with a two-tier architecture: a public hub for verified legal content and private, self-hosted nodes for community-based sharing.

### 2. System Architecture

#### 2.1 The Registry (Central Hub)

The "Public Square" of the ecosystem.

* **Content:** Strictly verified Public Domain (PD) or Creative Commons (CC) works.
* **Responsibility:** Hosted by the core project; acts as the primary "Safe Harbor."
* **Key Features:**
* **Global Discovery:** A searchable index of verified legal scores.
* **Distribution:** Serves the "Vault" Docker images and installation scripts.
* **Node Directory:** An opt-in "Yellow Pages" for choirs to list their node's public metadata.



#### 2.2 The Vault (The Node)

An independent, self-hosted instance (one per choir).

* **Content:** Private rehearsal scores, manual transcriptions, and peer-shared files.
* **Responsibility:** Managed 100% by the local choir director (The "Host").
* **Key Features:**
* **Interactive Renderer:** Uses **OpenSheetMusicDisplay (OSMD)** for in-browser rehearsal.
* **Permission Layers:** Granular access (Admin, Singer, Trusted Peer).
* **Federation Engine:** The logic for the "Handshake" protocol.



### 3. The Trust Protocol (Handshake)

To maintain the **"Private Circle"** legal status, sharing between nodes is never public.

1. **Request:** Admin A sends a handshake request to Node B’s endpoint.
2. **Verification:** Admins verify each other (e.g., via a shared choral association ID or manual approval).
3. **Mutual Trust:** A secure P2P tunnel or signed JWT exchange is established.
4. **Scanned Access:** Node A can now request metadata from Node B's "Shared" library.

### 4. Technical Stack Recommendations

| Layer | Technology | Reasoning |
| --- | --- | --- |
| **Backend** | **Node.js (NestJS)** or **Go** | High performance for file streaming; excellent for microservice/node logic. |
| **Database** | **PostgreSQL** | Relational integrity for complex node permissions. |
| **Music Rendering** | **OSMD / MusicXML** | Industry standard for web-based notation. |
| **Identity** | **OIDC / Keycloak** | Allows for "Login with Choir-ID" across the ecosystem. |
| **Infrastructure** | **Docker Compose** | Simplifies self-hosting for non-technical choir directors. |

### 5. Legal Logic (Liability Shield)

* **Passive Hosting:** The software is a neutral tool. The Vault admin is the "Service Provider."
* **Zero-Knowledge Indexing:** The Central Hub **never** crawls or indexes content within a private Vault.
* **Takedown Interface:** Every Vault node includes a standard `/copyright` form, fulfilling the "Notice and Action" requirements of the EU DSA.

---

**Would you like me to expand on the API schema for the Handshake Protocol or help you draft the `README.md` for the GitHub repository?**