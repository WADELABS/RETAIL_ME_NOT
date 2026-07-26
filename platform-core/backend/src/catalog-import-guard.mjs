function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} is required`);
  }
  return value.trim();
}

export function normalizeSupplierCatalogRow(row, context) {
  const {
    supplierKey,
    importedAt = new Date(),
    contentRightsConfirmed,
    imageHotlinkingPermitted,
  } = context;

  if (!contentRightsConfirmed) {
    return { accepted: false, state: 'REJECTED_CONTENT_RIGHTS_UNCONFIRMED' };
  }

  try {
    const manufacturerPartNumber = requiredString(
      row.manufacturer_part_number ?? row.mpn ?? row.sku,
      'manufacturer part number',
    );
    const title = requiredString(row.title ?? row.name, 'title');
    const wholesaleCostCents = Number(row.wholesale_cost_cents);
    const availableQuantity = Number(row.available_quantity ?? row.quantity ?? 0);

    if (!Number.isSafeInteger(wholesaleCostCents) || wholesaleCostCents < 0) {
      throw new TypeError('wholesale_cost_cents must be non-negative integer cents');
    }
    if (!Number.isSafeInteger(availableQuantity) || availableQuantity < 0) {
      throw new TypeError('available quantity must be a non-negative integer');
    }

    const imageUrl = row.image_url ? String(row.image_url) : null;
    const storedImageMode = imageUrl
      ? (imageHotlinkingPermitted ? 'AUTHORIZED_REMOTE_URL' : 'DOWNLOAD_TO_CONTROLLED_STORAGE')
      : 'NO_IMAGE';

    return {
      accepted: true,
      state: 'NORMALIZED',
      record: {
        supplierKey: requiredString(supplierKey, 'supplierKey'),
        manufacturerPartNumber,
        title,
        wholesaleCostCents,
        availableQuantity,
        externalOfferId: requiredString(row.external_offer_id ?? row.sku, 'external offer id'),
        condition: String(row.condition ?? 'NEW').toUpperCase(),
        imageUrl,
        storedImageMode,
        checkedAt: new Date(importedAt).toISOString(),
        rawPayload: row,
      },
    };
  } catch (error) {
    return {
      accepted: false,
      state: 'REJECTED_INVALID_ROW',
      error: error.message,
      rawPayload: row,
    };
  }
}
