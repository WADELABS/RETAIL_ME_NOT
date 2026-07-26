# Governance, Audit, and Compliance

This document outlines the platform's strategy for maintaining a verifiable, immutable record of all significant activities. This is a cornerstone of the "Enterprise Before Convenience" and "Every Decision is Explainable" design principles.

## 1. The Audit Log: The Single Source of Truth for Actions

The ECOS will maintain a centralized, immutable Audit Log that serves as the official, chronological record of every important state change and decision made across the entire platform.

- **Purpose:** The Audit Log is not for debugging or performance monitoring (that is the role of logs and traces). Its sole purpose is for governance, security reviews, compliance verification, and understanding the "who, what, when, where, and why" of any action.
- **Immutability:** Once written, records in the Audit Log can never be changed or deleted. The underlying data store will be configured for append-only operations (e.g., a write-once, read-many (WORM) compliant object storage bucket, or a managed blockchain service).
- **Source:** The Audit Log is populated automatically. The central `Audit` service subscribes to specific, high-signal events from the main Event Bus. It reformats these business events into a standardized audit format and persists them. This ensures that auditing is a seamless, built-in feature of the architecture, not an afterthought.

## 2. Structure of an Audit Event

Every record in the Audit Log will conform to a strict, standardized schema. This ensures consistency and allows for effective querying and analysis.

```json
{
  "eventId": "uuid-v4-unique-for-this-audit-entry",
  "timestamp": "ISO-8601-timestamp-with-utc",
  "domain": "The domain where the action originated (e.g., 'Pricing', 'Risk')",
  "action": "A standardized action name (e.g., 'PRICE_UPDATED', 'ORDER_FLAGGED')",
  "actor": {
    "type": "USER | SERVICE",
    "id": "The unique ID of the user or service principal",
    "ipAddress": "The source IP address of the request, if applicable"
  },
  "entity": {
    "type": "The type of entity being acted upon (e.g., 'PRODUCT', 'ORDER')",
    "id": "The unique ID of the entity (e.g., SKU, Order ID)"
  },
  "details": {
    "reason": "A human-readable reason or policy code for the action.",
    "correlationId": "The trace ID linking all logs and events for this request.",
    "before": {
      "state_key": "old_value"
    },
    "after": {
      "state_key": "new_value"
    }
  },
  "version": "1.0"
}
```

- **`actor`**: Identifies who performed the action. For automated system actions, this would be the service name. For user-driven actions, it would be the user's ID.
- **`entity`**: Identifies what was affected.
- **`details.before` / `details.after`**: For state changes, these fields contain a snapshot of the relevant data before and after the action, providing a clear delta. For non-mutation events (e.g., `ORDER_FLAGGED`), `before` may be null.

## 3. Compliance and Data Retention

- **Data Classification:** All data within the ECOS, and therefore all data within audit logs, will be classified according to a standard data classification policy (e.g., Public, Internal, Confidential, Restricted).
- **Retention Policy:** The Audit Log will be subject to a strict data retention policy, defined in alignment with legal and regulatory requirements (e.g., PCI-DSS, GDPR, CCPA). For example, logs containing personally identifiable information (PII) may need to be anonymized or deleted after a specific period, while financial transaction logs may need to be retained for several years.
- **Access Control:** Access to the Audit Log will be highly restricted. A very limited set of roles (e.g., Compliance Officer, Senior Security Engineer) will have read-only access for investigation purposes. No roles will have write or delete permissions outside of the automated system itself.
