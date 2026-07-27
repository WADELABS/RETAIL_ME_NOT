import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKey, normalizeMpn, findMatchingProduct, RawCatalogItem, MasterProduct } from '../src/matching';
import { CatalogIngestionService } from '../src/ingestor';
import { EdiDropshipAutomator, PurchaseOrderRecord } from '../../procurement/src/index';

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
    mpn: 'RTX 5070 TI 8GB',
    wholesaleCostCents: 68000,
  };

  const match = findMatchingProduct(rawItem, mockMasterProducts);
  assert.ok(match);
  assert.equal(match.sku, 'GPU-RTX-5070TI-WADE');
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
      mpn: 'RYZEN-UNKNOWN-MPN',
      wholesaleCostCents: 22000,
    }
  ];

  const ingestor = new CatalogIngestionService(mockMasterProducts);
  const result = await ingestor.processDistributorFeed('DISTRIBUTOR_A', feed);

  assert.equal(result.matchedCount, 1);
  assert.equal(result.draftCount, 1);
});


// --- 1. EDI DROPSHIP & VIRTUAL CARD AUTOMATION TESTS ---

test('EDI Dropship Automator translates Purchase Order and Virtual Card into EDI 850 document', () => {
  const automator = new EdiDropshipAutomator();

  const poRecord: PurchaseOrderRecord = {
    purchaseOrderId: 'PO-WADE-10293',
    orderId: 'c1b6202b-9dfb-48f2-9549-2a89df387c17',
    providerId: 'INGRAM_MICRO_B2B',
    totalWholesaleCostCents: 750000,
    status: 'PAID_UPFRONT_VIRTUAL_CARD',
    issuedCard: {
      cardId: 'ic_992288',
      pan: '4111111122223333',
      cvv: '123',
      expiration: '12/29',
      spendingLimitCents: 750000,
    },
    createdAt: new Date().toISOString(),
  };

  const items = [
    { sku: 'GPU-RTX-5070TI-WADE', quantity: 10, wholesaleCostCents: 750000 }
  ];

  const ediText = automator.translatePoToEdi850(poRecord, items);

  assert.ok(ediText.includes('ST*850*0001'), 'Must include Transaction Set 850 segment');
  assert.ok(ediText.includes('BEG*00*NE*PO-WADE-10293'), 'Must map the correct PO ID');
  assert.ok(ediText.includes('REF*CC*4111111122223333*EXP*12/29*CVV*123'), 'Must map and serialize the pre-paid virtual card details securely');
  assert.ok(ediText.includes('PO1*1*10*EA*7500.00**BP*GPU-RTX-5070TI-WADE'), 'Must translate line item cost, qty, and SKU');
});

test('EDI Dropship Automator successfully parses supplier EDI 855 Acknowledgment', () => {
  const automator = new EdiDropshipAutomator();

  const incomingEdi855 = [
    'ISA*00*          *00*          *ZZ*INGRAMMICRO    *ZZ*WADELABS       *260726*1600*U*00401*000000202*0*P*~',
    'GS*PR*INGRAMMICRO*WADELABS*20260726*1600*202*X*004010',
    'ST*855*0001',
    'BAK*01*AD*PO-WADE-10293*20260726',
    'SE*4*0001',
    'GE*1*202',
    'IEA*1*000000202'
  ].join('\n');

  const ack = automator.parseEdi855Acknowledgment(incomingEdi855);

  assert.equal(ack.purchaseOrderId, 'PO-WADE-10293', 'Must extract correct Purchase Order ID');
  assert.equal(ack.status, 'ACCEPTED', 'Status must parse as ACCEPTED from AD segment element');
});

test('EDI Dropship Automator successfully parses distributor EDI 856 Advanced Ship Notice for Blind Dropshipping', () => {
  const automator = new EdiDropshipAutomator();

  // Raw ANSI X12 EDI 856 representation of distributor shipment alerts
  const incomingEdi856 = [
    'ISA*00*          *00*          *ZZ*INGRAMMICRO    *ZZ*WADELABS       *260726*1630*U*00401*000000303*0*P*~',
    'GS*SH*INGRAMMICRO*WADELABS*20260726*1630*303*X*004010',
    'ST*856*0001',
    'BSN*00*992288*20260726*1630',
    'HL*1**S',
    'PRF*PO-WADE-10293', // Links back to our B2B Purchase Order
    'CAD***UPS*UPS GROUND', // Carrier details: UPS
    'HL*2*1*O',
    'HL*3*2*I',
    'REF*1Z*1Z999AA1013456784', // Carrier Tracking Number: 1Z999AA1013456784
    'SE*10*0001',
    'GE*1*303',
    'IEA*1*000000303'
  ].join('\n');

  const asn = automator.parseEdi856ShipNotice(incomingEdi856);

  assert.equal(asn.purchaseOrderId, 'PO-WADE-10293', 'Must extract and map original PO');
  assert.equal(asn.carrier, 'UPS GROUND', 'Must extract shipping carrier');
  assert.equal(asn.trackingNumber, '1Z999AA1013456784', 'Must extract carrier tracking ID to auto-send blind notifications');
});


// --- 2. BULK PRODUCT FEED PARSER TESTS ---

test('Catalog Ingestion Service successfully parses bulk CSV product feeds and matches items', async () => {
  const csvFeed = [
    'distributorSku,title,brand,mpn,wholesaleCostCents',
    'DA-998822,"Nvidia GeForce RTX 5070 Ti 8gb Graphics Card",NVIDIA,RTX-5070TI-8GB,68000',
    'DA-112233,"Unknown Core Processor",Intel,CORE-UNSTABLE-9,22000'
  ].join('\n');

  const ingestor = new CatalogIngestionService(mockMasterProducts);
  const result = await ingestor.parseBulkCsvFeed('DISTRIBUTOR_A', csvFeed);

  assert.equal(result.parsedCount, 2);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.draftCount, 1);
});
