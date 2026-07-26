# Risk & Fraud Prevention

## 1. Domain Definition

The Risk domain is the central nervous system for loss prevention in the ECOS. Its mission is to protect the business from fraud and abuse while minimizing friction for legitimate customers. It achieves this by generating a dynamic **Trust Score** for users and a **Risk Score** for actions.

- **Bounded Context:** This domain consumes a wide array of events from across the platform (customer behavior, order details, payment results) to build a comprehensive risk profile. It does not block actions directly. Instead, it publishes a `risk.assessment.completed` event with a score and a recommendation (e.g., `ALLOW`, `MANUAL_REVIEW`, `DECLINE`), which the Decision Engine uses as a critical input.
- **Core Services:**
    - **Risk Engine Service:** The core service that calculates Trust and Risk scores based on configurable policies.
    - **Behavioral Analytics Service:** Ingests high-volume user interaction events (hovers, clicks, scrolls) to detect anomalous patterns.
    - **Device Intelligence Service:** Analyzes device fingerprints to identify known fraudulent devices or unusual configurations.
    - **Manual Review Service:** Provides an interface and workflow for the Fraud Operations team to handle cases flagged for manual review.

## 2. Key Performance Indicators (KPIs)

- **Chargeback Rate:** Percentage of transactions that result in a chargeback.
- **Fraud Loss Rate:** The total financial loss from fraudulent transactions as a percentage of revenue.
- **Manual Review Rate:** Percentage of orders that are flagged for manual review.
- **False Positive Rate:** Percentage of legitimate orders that are incorrectly flagged for review or declined.
- **Automated Approval Rate:** Percentage of orders approved by the engine without any manual intervention.

## 3. Data Model

The Risk data model is designed for real-time analysis and long-term pattern detection.

### Core Tables

- **`customer_trust_profiles`**: A rolling, dynamic score for each customer.
  - `customer_id` (PK, FK), `trust_score` (numeric, e.g., 0-1000), `positive_factors` (JSONB, e.g., successful orders, account age), `negative_factors` (JSONB, e.g., chargebacks, return abuse), `last_updated_at`.
- **`risk_assessments`**: An immutable log of every risk decision. This provides full explainability.
  - `assessment_id` (PK), `target_entity_type` (ORDER, SESSION, RETURN), `target_entity_id`, `risk_score`, `recommendation` (ALLOW, MANUAL_REVIEW, DECLINE), `policy_version`, `contributing_factors` (JSONB), `created_at`.
- **`risk_policies`**: The configurable rules that drive the Risk Engine.
  - `policy_id` (PK), `name`, `is_active`, `rules` (JSONB).
  - **Example `rules` JSONB:**
    ```json
    {
      "thresholds": { "manual_review": 70, "decline": 95 },
      "velocity_checks": [
        { "event": "ORDER_ATTEMPT", "max": 3, "per_minutes": 60 }
      ],
      "factor_weights": {
        "avs_mismatch": 20,
        "new_device": 10,
        "high_value_product": 15,
        "successful_order_history": -30
      }
    }
    ```
- **`device_fingerprints`**: A record of devices used by customers.
  - `fingerprint_id` (PK), `customer_id` (FK), `fingerprint_hash`, `reputation` (TRUSTED, UNKNOWN, SUSPICIOUS), `first_seen`, `last_seen`.
- **`behavioral_events`**: High-volume, short-retention log of frontend user actions for session-level analysis.
  - `event_id`, `session_id`, `event_type` (e.g., `PASTE_IN_FORM`, `RAPID_ADD_TO_CART`), `timestamp`.

## 4. The Risk Engine: A Multi-Factor Model

The Risk Score is calculated by combining a **base score** from the customer's Trust Profile with a **real-time score** from the current action.

`Risk Score = customer_trust_profiles.trust_score + SUM(Real-time Factors)`

**1. Retrieve Customer Trust Score:** The engine starts with the customer's historical trust score. A new customer starts at a neutral baseline (e.g., 500).

**2. Evaluate Real-time Factors:** The engine applies a series of rules from the active `risk_policies`:
   - **Payment Verification:** AVS mismatch, CVV failure.
   - **Order Details:** High-value items, shipping to a new address, large quantity of a single item.
   - **Device Intelligence:** Is the device new? Does it have a suspicious reputation? Is it using a proxy/VPN?
   - **Behavioral Analytics:** Was the credit card number pasted into the form? Were items added to the cart impossibly fast?
   - **Velocity Checks:** Have there been too many order attempts from this IP address or for this customer account in the last hour?

**3. Calculate Final Score & Recommendation:**
   - The weighted sum of the real-time factors is added to the base trust score.
   - The final `risk_score` is compared against the policy thresholds to produce a recommendation (`ALLOW`, `MANUAL_REVIEW`, `DECLINE`).
   - The entire assessment is logged to the `risk_assessments` table for audit and explainability.

## 5. API Contracts (Conceptual)

- `POST /v1/assessments`: The primary endpoint. Takes an object to be assessed (e.g., an order payload), returns a full risk assessment including the score and recommendation.
- `GET /v1/policies`: List all risk policies.
- `POST /v1/policies`: Create a new risk policy.
- `GET /v1/reviews`: Get a list of orders in the manual review queue.
- `POST /v1/reviews/{id}/decisions`: Submit a decision (e.g., APPROVE, REJECT) for a manual review case.

## 6. Key Events

### Consumed
- `customer.session.started`
- `customer.authentication.failed`
- `checkout.initiated`
- `payment.verification.failed`
- `order.placed`
- `return.request.created`
- (And many more from across the ECOS)

### Published
- **`risk.assessment.completed`**: The domain's primary output. This event informs the Decision Engine of the risk level associated with an action.
  - **Payload**: The full record from the `risk_assessments` table.
- **`risk.customer-trust-score.changed`**: Fired when a customer's long-term trust score is updated (e.g., after a successful order or a chargeback).
  - **Payload**: `customer_id`, `new_trust_score`, `previous_trust_score`, `reason`.
- **`risk.manual-review.required`**: Signals the Manual Review Service to add an item to its queue.
  - **Payload**: `assessment_id`, `order_id`.
