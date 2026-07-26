import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryIntelligenceService, BrowserTelemetryPayload, CookieConsent } from '../src/index';
import { v4 as uuidv4 } from 'uuid';

test('Telemetry Ingestion accepts and processes events when consent is granted', async () => {
  const service = new TelemetryIntelligenceService();
  service.initialize();

  const sessionId = uuidv4();
  const sku = 'LAPTOP-WADE-01';

  // Customer gives full consent
  const consent: CookieConsent = {
    essential: true,
    analytical: true,
    marketing: true,
  };

  const payload: BrowserTelemetryPayload = {
    sessionId,
    eventType: 'SEARCH',
    payload: { query: 'wade laptop', matchedSkus: [sku] },
  };

  const result = await service.ingestBrowserTelemetry(payload, consent);
  assert.equal(result.status, 'ACCEPTED', 'Should accept telemetry when consent is granted');

  const logs = service.getSessionLogs(sessionId);
  assert.equal(logs?.length, 1, 'Should record the event in the session log');
  assert.equal(logs[0].eventType, 'SEARCH');
});

test('Telemetry Ingestion strictly drops analytical events when analytical consent is denied (GDPR/CCPA)', async () => {
  const service = new TelemetryIntelligenceService();
  service.initialize();

  const sessionId = uuidv4();
  const sku = 'LAPTOP-WADE-01';

  // Customer denies analytical consent
  const consent: CookieConsent = {
    essential: true,
    analytical: false, // DENIED
    marketing: true,
  };

  const payload: BrowserTelemetryPayload = {
    sessionId,
    eventType: 'SEARCH',
    payload: { query: 'wade laptop', matchedSkus: [sku] },
  };

  const result = await service.ingestBrowserTelemetry(payload, consent);
  assert.equal(result.status, 'REJECTED_CONSENT_DENIED', 'Should block and drop search events when analytical consent is denied');

  const logs = service.getSessionLogs(sessionId);
  assert.equal(logs, undefined, 'No session log should be created or stored');
});

test('Telemetry Ingestion blocks referral tracking when marketing consent is denied', async () => {
  const service = new TelemetryIntelligenceService();
  service.initialize();

  const sessionId = uuidv4();

  // Customer denies marketing consent
  const consent: CookieConsent = {
    essential: true,
    analytical: true,
    marketing: false, // DENIED
  };

  const payload: BrowserTelemetryPayload = {
    sessionId,
    eventType: 'REFERRAL_CLICK',
    payload: { referrerId: 'creator_123' },
  };

  const result = await service.ingestBrowserTelemetry(payload, consent);
  assert.equal(result.status, 'REJECTED_CONSENT_DENIED', 'Should block affiliate/referral tracking when marketing consent is denied');
});

test('ECOS complies with GDPR/CCPA by completely purging customer data on deletion request', async () => {
  const service = new TelemetryIntelligenceService();
  service.initialize();

  const customerId = uuidv4();
  const sessionId = uuidv4();
  const sku = 'LAPTOP-WADE-01';

  const consent: CookieConsent = { essential: true, analytical: true, marketing: true };

  // 1. Populate some historical session telemetry
  await service.ingestBrowserTelemetry(
    {
      sessionId,
      customerId,
      eventType: 'SEARCH',
      payload: { query: 'wade laptop', matchedSkus: [sku] },
    },
    consent
  );

  const initialLogs = service.getSessionLogs(sessionId);
  assert.equal(initialLogs?.length, 1, 'Should have populated the logs initially');

  // 2. Trigger the autonomous data anonymization / deletion request
  await service.anonymizeCustomerData(customerId, sessionId);

  // 3. Verify all traces are wiped
  const clearedLogs = service.getSessionLogs(sessionId);
  assert.equal(clearedLogs, undefined, 'GDPR Deletion must completely erase all historical telemetry logs for that session');
});
