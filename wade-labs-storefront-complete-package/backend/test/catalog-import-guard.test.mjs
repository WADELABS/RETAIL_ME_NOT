import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSupplierCatalogRow } from '../src/index.mjs';

test('authorized supplier row is normalized with cents and MPN identity', () => {
  const result = normalizeSupplierCatalogRow({
    sku: 'MSI-A2HWGG-008US',
    title: 'MSI Stealth AI',
    wholesale_cost_cents: 150000,
    quantity: 3,
    image_url: 'https://supplier.example/image.jpg',
  }, {
    supplierKey: 'SUPPLIER_A',
    contentRightsConfirmed: true,
    imageHotlinkingPermitted: false,
    importedAt: '2026-07-20T12:00:00.000Z',
  });
  assert.equal(result.accepted, true);
  assert.equal(result.record.manufacturerPartNumber, 'MSI-A2HWGG-008US');
  assert.equal(result.record.storedImageMode, 'DOWNLOAD_TO_CONTROLLED_STORAGE');
});

test('catalog row is rejected when content rights are not confirmed', () => {
  const result = normalizeSupplierCatalogRow({}, {
    supplierKey: 'SUPPLIER_A',
    contentRightsConfirmed: false,
    imageHotlinkingPermitted: false,
  });
  assert.equal(result.accepted, false);
  assert.equal(result.state, 'REJECTED_CONTENT_RIGHTS_UNCONFIRMED');
});
