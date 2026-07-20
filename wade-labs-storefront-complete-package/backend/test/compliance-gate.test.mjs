import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLouisianaLaunchGate } from '../src/index.mjs';

const base = {
  ldrRegistrationStatus: 'PROCESSED',
  resaleCertificateStatus: 'PENDING',
  taxCalculationConfigured: true,
  paymentIntegrationVerified: true,
  customerPoliciesPublished: true,
  distributorAccountApproved: true,
  distributorCertificateAccepted: false,
  authorizedCatalogRights: true,
};

test('pending resale certificate allows owned inventory but blocks default tax-exempt distributor launch', () => {
  const result = evaluateLouisianaLaunchGate(base);
  assert.equal(result.canSellOwnedInventory, true);
  assert.equal(result.canSellDistributorInventory, false);
  assert.equal(result.distributorListingMode, 'DRAFT_OR_COMING_SOON');
  assert.ok(result.blockers.includes('RESALE_CERTIFICATE_NOT_ACTIVE'));
});

test('approved certificate plus distributor acceptance enables distributor inventory', () => {
  const result = evaluateLouisianaLaunchGate({
    ...base,
    resaleCertificateStatus: 'APPROVED_ACTIVE',
    distributorCertificateAccepted: true,
  });
  assert.equal(result.canSellDistributorInventory, true);
  assert.equal(result.taxExemptProcurementReady, true);
});

test('tax-paid procurement can be explicitly enabled only when supplier tax is included in the floor', () => {
  const result = evaluateLouisianaLaunchGate({
    ...base,
    allowTaxPaidProcurement: true,
    supplierTaxIncludedInProfitFloor: true,
  });
  assert.equal(result.canSellDistributorInventory, true);
  assert.equal(result.taxPaidProcurementReady, true);
});
