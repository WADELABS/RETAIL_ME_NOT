const CERTIFICATE_STATES = new Set([
  'NOT_APPLIED',
  'PENDING',
  'APPROVED_ACTIVE',
  'EXPIRING',
  'EXPIRED',
  'DENIED',
  'REVOKED',
]);

function requireBoolean(value, name) {
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be boolean`);
}

export function evaluateLouisianaLaunchGate(input) {
  const {
    ldrRegistrationStatus,
    resaleCertificateStatus,
    taxCalculationConfigured,
    paymentIntegrationVerified,
    customerPoliciesPublished,
    distributorAccountApproved,
    distributorCertificateAccepted,
    authorizedCatalogRights,
    allowTaxPaidProcurement = false,
    supplierTaxIncludedInProfitFloor = false,
  } = input;

  if (!['NOT_STARTED', 'SUBMITTED', 'PROCESSED'].includes(ldrRegistrationStatus)) {
    throw new TypeError('invalid ldrRegistrationStatus');
  }
  if (!CERTIFICATE_STATES.has(resaleCertificateStatus)) {
    throw new TypeError('invalid resaleCertificateStatus');
  }
  for (const [key, value] of Object.entries({
    taxCalculationConfigured,
    paymentIntegrationVerified,
    customerPoliciesPublished,
    distributorAccountApproved,
    distributorCertificateAccepted,
    authorizedCatalogRights,
    allowTaxPaidProcurement,
    supplierTaxIncludedInProfitFloor,
  })) requireBoolean(value, key);

  const registrationProcessed = ldrRegistrationStatus === 'PROCESSED';
  const certificateActive = resaleCertificateStatus === 'APPROVED_ACTIVE';
  const baseCommerceReady =
    registrationProcessed &&
    taxCalculationConfigured &&
    paymentIntegrationVerified &&
    customerPoliciesPublished;

  const canBuild = true;
  const canImportAuthorizedCatalog = authorizedCatalogRights;
  const canSellOwnedInventory = baseCommerceReady;

  const taxExemptProcurementReady =
    certificateActive &&
    distributorAccountApproved &&
    distributorCertificateAccepted;

  const taxPaidProcurementReady =
    allowTaxPaidProcurement &&
    supplierTaxIncludedInProfitFloor &&
    distributorAccountApproved;

  const canSellDistributorInventory =
    baseCommerceReady &&
    authorizedCatalogRights &&
    (taxExemptProcurementReady || taxPaidProcurementReady);

  const blockers = [];
  if (!registrationProcessed) blockers.push('LDR_REGISTRATION_NOT_PROCESSED');
  if (!taxCalculationConfigured) blockers.push('TAX_CALCULATION_NOT_CONFIGURED');
  if (!paymentIntegrationVerified) blockers.push('PAYMENT_INTEGRATION_NOT_VERIFIED');
  if (!customerPoliciesPublished) blockers.push('CUSTOMER_POLICIES_NOT_PUBLISHED');
  if (!authorizedCatalogRights) blockers.push('CATALOG_RIGHTS_NOT_CONFIRMED');
  if (!distributorAccountApproved) blockers.push('DISTRIBUTOR_ACCOUNT_NOT_APPROVED');

  if (!certificateActive && !taxPaidProcurementReady) {
    blockers.push('RESALE_CERTIFICATE_NOT_ACTIVE');
  }
  if (certificateActive && !distributorCertificateAccepted && !taxPaidProcurementReady) {
    blockers.push('CERTIFICATE_NOT_ACCEPTED_BY_DISTRIBUTOR');
  }

  return {
    registrationProcessed,
    certificateActive,
    taxExemptProcurementReady,
    taxPaidProcurementReady,
    canBuild,
    canImportAuthorizedCatalog,
    canSellOwnedInventory,
    canSellDistributorInventory,
    distributorListingMode: canSellDistributorInventory ? 'ACTIVE' : 'DRAFT_OR_COMING_SOON',
    blockers: [...new Set(blockers)],
  };
}
