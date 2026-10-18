# Emperor CRM v1 — Architecture & Technical Specifications

## 1. Database Schema & Search Indexing Strategy

### Relational Model
Emperor CRM v1 uses PostgreSQL with Prisma ORM. Key tables:
- `users`: Core account model with Argon2id hashed passwords, role enum (`FREELANCER`, `ADMIN`, `OPERATOR`), timezones, and JSONB `preferences`.
- `leads`: Opportunities owned by users (`userId` FK with cascade delete), fixed enum `stage` (`IDENTIFIED`, `CONTACTED`, `REPLIED`, `MEETING`, `PROPOSAL_SENT`, `WON`, `LOST`), currency, potential and won values with `DECIMAL(12,2)` precision, and `nextFollowUp` date index.
- `interactions`: Timeline events (`EMAIL`, `CALL`, `MESSAGE`, `MEETING`, `OTHER`) with direction (`OUTGOING`, `INCOMING`).
- `tasks`: Actionable follow-ups with status (`PENDING`, `COMPLETED`, `CANCELLED`), due dates, and optional lead linkage.
- `activities`: Audit log recording state transitions and user actions.
- `support_access_grants`: Explicit consent tokens allowing admins/operators time-bounded read-only inspection of user data.
- `password_reset_tokens`: 32-byte cryptographically random token hashes expiring in 60 minutes.

### Trigram GIN Search Indexing (`pg_trgm`)
To support lightning-fast, case-insensitive substring search across `name`, `company`, and `email` without external search infrastructure (e.g. Elasticsearch), PostgreSQL's `pg_trgm` extension is enabled in the initial migration:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "leads_name_trgm_idx" ON "leads" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "leads_company_trgm_idx" ON "leads" USING gin ("company" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "leads_email_trgm_idx" ON "leads" USING gin ("email" gin_trgm_ops);
```
**Why GIN Trigram?**
Standard B-tree indexes only optimize prefix matches (`LIKE 'abc%'`). In a real freelancer CRM, users search by partial company names (`"botics"` matching `"Aether Robotics"`), domains, or first/last names. The GIN trigram index breaks strings into 3-character slices, allowing arbitrary substring searches (`ILIKE '%search%'`) to execute via index scans rather than full table sequential scans.

---

## 2. Authentication & Session Strategy

- **Password Hashing**: Passwords hashed with `Argon2id` (the winner of the Password Hashing Competition), using 64MB memory cost, 3 iterations, and 4 degrees of parallelism.
- **Session Tokens**: JWT signed with HS256 containing `sub` (userId), `role`, `name`, `email`, and `timezone`.
- **Transmission & Storage**: Dual-mode transport:
  1. `httpOnly`, `SameSite=Lax`, secure cookie (`emperor_session`).
  2. `Authorization: Bearer <token>` header support for API requests.
- **Session Expiry Handling**: On expired or malformed token, backend returns `401 Unauthorized` with `{ code: "SESSION_EXPIRED", message: "Your session expired. Please sign in again." }`.
- **Password Reset Security**: Raw tokens are 32-byte cryptographically secure random hex strings (`crypto.randomBytes(32)`). Only the SHA-256 digest is stored in the database. Reset URLs expire after 60 minutes and are rendered unusable upon first consumption (`usedAt`).

---

## 3. Rate Limiting Strategy

- **Implementation**: Sliding-window in-memory bucket rate limiter keyed by `${ip}:${email}:${action}`.
- **Limit**: Maximum 5 attempts per 15 minutes per IP + email tuple for `/login` and `/forgot-password`.
- **Choice Justification**: In-memory rate limiting delivers sub-millisecond overhead with zero third-party cloud dependencies (no external network latency or Redis cold starts). For multi-instance distributed deployments, an Upstash Redis adapter can be swapped in with identical method signatures.

---

## 4. Idempotency & Duplicate Lead Protection

- **UI Level**: Submit button is disabled while pending, preventing rapid double-clicking.
- **Server Action Level**: When creating a lead, the transaction checks for any lead created by the same `userId` with the identical `name` AND `email` within the last 10 seconds:
  ```ts
  const tenSecondsAgo = new Date(Date.now() - 10000);
  const duplicate = await prisma.lead.findFirst({
    where: {
      userId,
      name,
      email: email || undefined,
      createdAt: { gte: tenSecondsAgo }
    }
  });
  ```
  If found, the request returns a friendly idempotent error without creating duplicate records or firing redundant activities.

---

## 5. Leads List Pagination Strategy

- **Choice**: Offset-based pagination with 15 items per page and a total count indicator.
- **Justification**:
  1. Allows direct jumping to specific pages (page numbers are URL-persisted: `?page=2`).
  2. Works predictably with multi-field sorting (next follow-up date, name, potential value, created date) and complex multi-select filters.
  3. Provides clear visibility of total pipeline size (`"Showing 1-15 of 48 leads"`).

---

## 6. Pipeline High-Volume Performance Strategy

- **Column-Level Optimized Querying**: For boards handling 500+ leads, the `/pipeline` board loads leads grouped by `stage` using index `@@index([userId, stage])` with an active-leads filter (`archivedAt: null`).
- **Data Pruning**: Pipeline cards omit heavyweight fields (full rich notes, long descriptions) and retrieve only display essentials (`id`, `name`, `company`, `service`, `potentialValue`, `nextFollowUp`, `stage`, `source`).
- **Optimistic Drag-and-Drop**: Moves resolve instantly on client state with rollback and toast notification if the server update fails.
