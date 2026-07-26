# Wade Labs Storefront Complete Package

This folder consolidates the complete premium-electronics storefront work product.

## Structure

- `docs/` — roadmap, design strategy, backend blueprint, and master implementation specifications.
- `backend/` — complete Node.js reference engine, SQL migrations, tests, examples, and configuration template.
- `validation/` — implementation lock and specification validator.
- `reference/` — user-supplied source material used to shape the specification.
- `archives/` — prior and current package archives retained for traceability.
- `manifests/` — earlier SHA-256 manifests.

## Current compliance lock

```text
LDR_REGISTRATION_STATUS=PROCESSED
LOUISIANA_RESALE_CERTIFICATE_STATUS=PENDING
```

Sensitive taxpayer identifiers, LaTAP credentials, Stripe secrets, Mercury credentials, and distributor credentials are intentionally excluded.

## Verification

```bash
cd backend
npm test
python ../validation/validate_storefront_spec.py
```


## Advertising, Marketing, Growth, and UI/UX

Included:

- `docs/advertising-marketing-growth-uiux-blueprint.md`
- `backend/src/marketing-profit-engine.mjs`
- `backend/src/growth-gate.mjs`
- `backend/src/ux-experiment-gate.mjs`
- `backend/sql/003_marketing_growth_and_ux.sql`
- Automated marketing, growth, and UX tests

These lock campaign profitability, allowable CAC, conservative LTV, slow budget scaling, cohorts, retention, channel strategy, growth freezes, responsive UI/UX, accessibility, performance, and contribution-based experiments.
