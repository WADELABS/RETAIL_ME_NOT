from pathlib import Path
import json
import re
import sys

root = Path(__file__).resolve().parent
spec_path = root / "premium-electronics-storefront-final-implementation-spec.md"
lock_path = root / "storefront-implementation-lock.json"

errors = []

if not spec_path.exists():
    errors.append("missing specification file")
if not lock_path.exists():
    errors.append("missing implementation lock file")

if errors:
    print("FAIL:", "; ".join(errors))
    sys.exit(1)

spec = spec_path.read_text(encoding="utf-8")
lock = json.loads(lock_path.read_text(encoding="utf-8"))

required_phrases = [
    "Stripe backend webhooks are authoritative for all purchases",
    "payment_intent.succeeded",
    "payment_intent.processing",
    "POST /api/webhooks/stripe",
    "APPROVED_ACTIVE",
    "DistributorAdapter",
    "PAYMENT_RECONCILIATION_HOLD",
    "Business-use withdrawal triggers use-tax accounting",
    "One Stripe purchase flow",
]

for phrase in required_phrases:
    if phrase not in spec:
        errors.append(f"missing required phrase: {phrase}")

required_sections = [
    "# 18. Stripe Payment Architecture",
    "# 19. Stripe Backend Webhooks for All Purchases",
    "# 25. Louisiana Resale Certificate — Approved State",
    "# 32. Acceptance Tests",
    "# 34. Audit Findings",
]

for section in required_sections:
    if section not in spec:
        errors.append(f"missing required section: {section}")

if lock.get("business_model") != "DIRECT_RETAIL_DISTRIBUTOR_API_FIRST":
    errors.append("business model lock is incorrect")

stripe = lock.get("stripe", {})
if stripe.get("authoritative_purchase_trigger") != "SIGNED_BACKEND_WEBHOOK":
    errors.append("Stripe webhook authority is not locked")
if stripe.get("all_purchases_use_webhook_state_machine") is not True:
    errors.append("all-purchases webhook rule is not enabled")
if stripe.get("processing_is_fulfillable") is not False:
    errors.append("processing state must not be fulfillable")
if stripe.get("browser_callback_is_authoritative") is not False:
    errors.append("browser callback must not be authoritative")

cert = lock.get("louisiana_resale_certificate", {})
if cert.get("status") != "APPROVED_ACTIVE":
    errors.append("resale certificate is not approved active")
if cert.get("must_populate_from_issued_certificate") is not True:
    errors.append("certificate dates must be populated from issued certificate")
if cert.get("may_be_used_for_business_consumption") is not False:
    errors.append("business-use restriction is missing")

test_lines = re.findall(r"^\d+\.\s", spec, flags=re.MULTILINE)
if len(test_lines) < 76:
    errors.append(f"expected at least 76 numbered acceptance tests/items; found {len(test_lines)}")

if errors:
    print("FAIL")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("PASS")
print(f"spec_lines={len(spec.splitlines())}")
print(f"spec_bytes={len(spec.encode('utf-8'))}")
print(f"numbered_items={len(test_lines)}")
print("stripe_webhooks=LOCKED_FOR_ALL_PURCHASES")
print("resale_certificate=APPROVED_ACTIVE")
