# Staging Deployment & Production Readiness Gate Specification

## 1. The Promotion Model

ECOS does not deploy directly to production. All changes must transition through a strict, gated staging-to-production pipeline. No manual bypasses of this pipeline are permitted under corporate governance rules.

```text
Commit to main
      │
      ▼
Job 1: ECOS Verification (Unit/Simulation/Contracts)
      │
      ▼
Job 2: Security & Dependency Audit (npm audit / secret scanning)
      │
      ▼
Job 3: Database Migration Dry-Run (Knex local test compilation)
      │
      ▼
Job 4: Workspace Compilation Smoke Test (npx tsc --noEmit)
      │
      ▼
Job 5: Container Build & Push (Staging Registry)
      │
      ▼
Job 6: Staging Deployment & Staging DB Migration
      │
      ▼
Job 7: Staging Sandbox E2E Transaction Test (Stripe/Mercury Sandbox)
      │
      ▼
Job 8: Database Rollback Verification (Knex rollback test)
      │
      ▼
Job 9: Observability & Telemetry Smoke Test
      │
      ▼
======================= RELEASE GATE APPROVED =======================
      │
      ▼
Job 10: Manual Release Approval & Production Promotion (Signed Record)
```

## 2. Container Build & Staging Promotion

Every service and application in the monorepo is packaged as a lightweight Docker container image:
- **Build Tagging:** Images are tagged using the unique Git Commit SHA and a semantic version (e.g., `ecos-orders:sha-cc1fd52` and `ecos-orders:v1.2.4`).
- **Immutable Staging Registry:** Successfully built images are pushed to a secure, private registry (e.g., Google Artifact Registry).
- **Staging Deployment:** The CI/CD runner automatically updates the Kubernetes staging manifests (Helm charts) with the new image tags and deploys them to the staging namespace.

## 3. Staging Sandbox E2E Transaction Test

Immediately following a staging deployment, a synthetic end-to-end checkout script is executed. This "smoke test" simulates a live customer checkout flow using third-party sandbox APIs:
- **Stripe Sandbox:** Processes a mock transaction using a test credit card number, verifying that our Webhook Inbox is receiving and cryptographically validating the payment intents.
- **Mercury Sandbox:** Simulates an API call to verify bank balance and execute the subsequent B2B distributor payment.
- **SLA:** If the sandbox checkout fails or times out, the deployment is marked as **FAILED**, the pipeline stops, and an alarm is triggered. Staging remains locked until resolved.

## 4. Database Rollback Verification

To ensure that any database schema changes can be undone cleanly during an operational emergency, our CI pipeline runs an automated rollback test in staging:
1.  **Apply Migration:** Run `knex migrate:latest` on the staging database.
2.  **Verify State:** Check that the tables and columns exist.
3.  **Rollback Migration:** Run `knex migrate:rollback` to execute the `down` function of the new migration.
4.  **Verify Rollback State:** Check that the database schema is back to its previous, clean state with zero errors.
5.  **Re-apply Migration:** Re-apply the migration to leave staging ready for the sandbox tests.

If the rollback fails or throws a SQL error, the release gate is blocked.

## 5. Observability & Telemetry Smoke Test

A staging deployment is not considered "healthy" just because the container boots. It must successfully output telemetry:
- **Distributed Tracing:** The synthetic sandbox transaction must generate a trace ID (`correlationId`) that successfully propagates across the orders, tax, treasury, and accounting services, verifiable in Jaeger/Zipkin.
- **Structured Log Harvesting:** Every service must output structured JSON logs to `stdout`, and the logging agent (e.g., FluentBit/Elastic) must successfully harvest and index them.
- **Metrics Scraping:** The services must expose a `/metrics` endpoint that is successfully scraped by Prometheus.

If a service fails to emit telemetry within 5 minutes of booting, the deployment is flagged.

## 6. Release Promotion Approval Gate

Promotion from Staging to Production is protected by a manual gate. Once all automated stages (1 through 9) pass successfully:
- A **Release Candidate (RC)** is declared.
- An automated notification is sent to the **Filing & Compliance Slack Channel** with a link to the complete, successful staging audit log.
- **Signed Record:** A designated release manager or corporate officer must manually click "Approve Release" in the GitHub Actions dashboard.
- **Approval Metadata:** The approval action requires entering a human-readable changelog and release reason, which is saved as an immutable audit record in our `decision_audit` log.
- **Production Deploy:** Upon approval, the release gate promotes the images to the production Kubernetes cluster.
