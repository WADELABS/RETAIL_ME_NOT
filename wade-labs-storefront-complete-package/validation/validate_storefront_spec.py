from pathlib import Path
import json
import re
import sys

here = Path(__file__).resolve().parent

spec_candidates = [
    here / "premium-electronics-storefront-final-implementation-spec.md",
    here.parent / "docs" / "premium-electronics-storefront-final-implementation-spec.md",
]
lock_candidates = [
    here / "storefront-implementation-lock.json",
    here.parent / "validation" / "storefront-implementation-lock.json",
]

spec_path = next((p for p in spec_candidates if p.exists()), None)
lock_path = next((p for p in lock_candidates if p.exists()), None)

errors = []
if spec_path is None:
    errors.append("missing specification file")
if lock_path is None:
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
    "LOUISIANA_RESALE_CERTIFICATE_STATUS=PENDING",
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
    "# 25. Louisiana Registration and Resale Certificate — Pending State",
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

registration = lock.get("louisiana_registration", {})
if registration.get("registration_status") != "PROCESSED":
    errors.append("Louisiana registration must be PROCESSED")

cert = lock.get("louisiana_resale_certificate", {})
if cert.get("status") != "PENDING":
    errors.append("resale certificate must remain PENDING until issued and validated")
if cert.get("must_populate_from_issued_certificate") is not True:
    errors.append("certificate fields must be populated from the issued certificate")
if cert.get("may_be_used_for_business_consumption") is not False:
    errors.append("business-use restriction is missing")

profit = lock.get("profit_priority", {})
if profit.get("optimization_target") != "EXPECTED_CONTRIBUTION":
    errors.append("profit optimization target is not locked")
if profit.get("hard_margin_floor") is not True:
    errors.append("hard margin floor is not locked")

numbered_items = re.findall(r"^\d+\.\s", spec, flags=re.MULTILINE)
if len(numbered_items) < 76:
    errors.append(f"expected at least 76 numbered items; found {len(numbered_items)}")

if errors:
    print("FAIL")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("PASS")
print(f"spec_path={spec_path}")
print(f"lock_path={lock_path}")
print(f"spec_lines={len(spec.splitlines())}")
print(f"spec_bytes={len(spec.encode('utf-8'))}")
print(f"numbered_items={len(numbered_items)}")
print("stripe_webhooks=LOCKED_FOR_ALL_PURCHASES")
print("ldr_registration=PROCESSED")
print("resale_certificate=PENDING")
print("profit_target=EXPECTED_CONTRIBUTION")
