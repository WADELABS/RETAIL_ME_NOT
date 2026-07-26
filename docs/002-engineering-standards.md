# Engineering Standards

This document defines the mandatory technical standards and practices for all software developed within the Enterprise Commerce Operating System (ECOS). Adherence to these standards is not optional; it is essential for maintaining the platform's quality, security, and long-term maintainability.

## 1. Code Development

### 1.1. Code Style
- All code will be automatically formatted on commit using Prettier with the repository-defined configuration.
- All code will be analyzed by a static linter (e.g., ESLint for TypeScript) using the repository-defined ruleset. Linting errors must be fixed before a pull request can be merged.

### 1.2. Branching & Merging
- All work will be done on feature branches created from the `main` branch.
- Direct commits to `main` are prohibited.
- All changes must be submitted via a Pull Request (PR).
- A PR must be reviewed and approved by at least one other engineer before merging.
- A PR must pass all automated CI checks (linting, testing, type checking) before it can be merged.

## 2. API Design & Communication

### 2.1. API-First Principle
- All services must be designed with an API-first approach. The API contract is the primary artifact.
- API contracts will be defined using the OpenAPI 3.x specification for RESTful services or Protobuf 3 for gRPC services.

### 2.2. REST API Standards
- **Versioning:** APIs must be versioned (e.g., `/api/v1/catalog/products`). Versioning is done by major, non-breaking changes increment the minor version, but the URL path only reflects the major version.
- **Authentication:** All endpoints must be secured. Authentication will be handled by the central `Identity` service using JWTs.
- **Authorization:** Authorization will be handled by the central `Permissions` service (RBAC). Service-to-service communication will also be authenticated and authorized.
- **Pagination:** All collection-based endpoints (`GET /resources`) must be paginated using a consistent, cursor-based method.
- **Error Handling:** Errors must return standard HTTP status codes and a consistent JSON error body: `{ "correlationId": "...", "errorCode": "...", "message": "..." }`.
- **Naming:** Endpoints and resources will use plural nouns (e.g., `/products`, `/suppliers`).

### 2.3. Event Standards
- All events published to the Event Bus must conform to a schema defined in the central Schema Registry (using Avro or Protobuf).
- Event names will use a `Domain.Entity.Action` past-tense format (e.g., `orders.order.placed`, `pricing.recommendation.created`).
- Events are immutable and must contain all relevant data for subscribers to act without needing to call back to the source service ("fat events").

## 3. Database & Data Management

### 3.1. Migrations
- All database schema changes must be made via versioned migration files using the approved migration tool (e.g., Knex.js).
- Migrations must be backward-compatible. A rollback script must be provided for every migration.
- Direct, manual changes to a production database schema are strictly forbidden.

### 3.2. Data Integrity
- Data models must be normalized to at least 3rd Normal Form (3NF) unless a compelling, documented performance reason exists for denormalization.
- Foreign key constraints must be used to enforce relational integrity.

## 4. Testing & Quality Assurance

### 4.1. Testing Pyramid
Every service must have a comprehensive suite of automated tests following the testing pyramid model:
1.  **Unit Tests (Fast & Numerous):** Test individual functions and classes in isolation. Code coverage for unit tests must meet or exceed a configurable threshold (e.g., 80%).
2.  **Integration Tests (Fewer):** Test the interaction between components within a single service (e.g., API layer to database). These tests will run against a real, containerized database instance.
3.  **End-to-End (E2E) / Acceptance Tests (Fewest):** Test a complete business workflow across multiple services. These tests will be written in a behavior-driven style (e.g., Gherkin) and will run against a deployed, production-like environment.

### 4.2. CI/CD Pipeline
- The CI (Continuous Integration) pipeline will run automatically on every PR. It is responsible for:
    - Installing dependencies.
    - Running linters and formatters.
    - Running all unit and integration tests.
    - Performing a security scan on dependencies.
    - Building service artifacts (e.g., Docker images).
- The CD (Continuous Deployment) pipeline will deploy successfully merged changes to a staging environment automatically. Deployment to production will be a manual, gated process requiring approval.

## 5. Observability

Every service must be observable. This is non-negotiable.
- **Structured Logging:** All logs must be written to `stdout` as structured JSON. Logs must include a `correlationId` to trace a request's lifecycle through multiple services.
- **Metrics:** Every service must expose key operational metrics in a Prometheus-compatible format (e.g., request rate, error rate, latency percentiles).
- **Distributed Tracing:** Every service must participate in distributed tracing. Incoming requests with a trace header must propagate it to any downstream requests (API calls, event publications).

## 6. Security

- **Secrets Management:** No secrets (API keys, passwords, credentials) are ever to be stored in source code. All secrets will be managed by a central secrets management service (e.g., HashiCorp Vault, AWS Secrets Manager) and injected into services at runtime.
- **Dependency Scanning:** The CI pipeline will automatically scan all third-party dependencies for known vulnerabilities. Builds with critical vulnerabilities will be failed.
- **Principle of Least Privilege:** Services and users should only be granted the absolute minimum permissions required to perform their function.
