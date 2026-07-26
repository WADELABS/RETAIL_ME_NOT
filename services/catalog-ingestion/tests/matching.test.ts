import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKey, normalizeMpn, findMatchingProduct, RawCatalogItem, MasterProduct } from '../src/matching';
import { CatalogIngestionService } from '../src/ingestor';

const mockMasterProducts: MasterProduct[] = [
  { sku: 'GPU-RTX-5070TI-WADE', brandName: 'NVIDIA', mpn: 'RTX-5070TI-8GB' },
  { sku: 'LAPTOP-STEALTH-16', brandName: 'MSI', mpn: 'STEALTH-16-AI' }
];

test('Text and Key normalization works correctly', () => {
  assert.equal(normalizeKey('  NVIDIA GeForce  '), 'nvidiageforce');
  assert.equal(normalizeKey('MSI-STEALTH-16!'), 'msistealth16');
});

test('MPN normalization handles dashes and format variations', () => {
  assert.equal(normalizeMpn('RTX-5070TI-8GB'), 'rtx5070ti8gb');
  assert.equal(normalizeMpn('rtx  5070 ti 8gb'), 'rtx5070ti8gb');
});

test('Product Matching Engine matches messy distributor inputs to clean master product', () => {
  const rawItem: RawCatalogItem = {
    distributorSku: 'DA-998822',
    title: 'Nvidia Geforce RTX 5070 Ti 8gb Graphics Card',
    brand: 'NVIDIA',
    mpn: 'RTX 5070 TI 8GB', // Messy formatting, spaces instead of dashes
    wholesaleCostCents: 68000,
  };

  const match = findMatchingProduct(rawItem, mockMasterProducts);
  assert.ok(match, 'Should find a match');
  assert.equal(match.sku, 'GPU-RTX-5070TI-WADE', 'Should map to the correct ECOS SKU');
});

test('Product Ingestion Service processes feeds and publishes events', async () => {
  const feed: RawCatalogItem[] = [
    {
      distributorSku: 'DA-998822',
      title: 'Nvidia Geforce RTX 5070 Ti 8gb Graphics Card',
      brand: 'NVIDIA',
      mpn: 'RTX-5070TI-8GB',
      wholesaleCostCents: 68000,
    },
    {
      distributorSku: 'DA-112233',
      title: 'Unknown Random Processor',
      brand: 'AMD',
      mpn: 'RYZEN-UNKNOWN-MPN', // Unmatched, should trigger a draft
      wholesaleCostCents: 22000,
    }
  ];

  const ingestor = new CatalogIngestionService(mockMasterProducts);
  const result = await ingestor.processDistributorFeed('DISTRIBUTOR_A', feed);

  assert.equal(result.matchedCount, 1, 'Should match one item');
  assert.equal(result.draftCount, 1, 'Should create one draft item');
});
