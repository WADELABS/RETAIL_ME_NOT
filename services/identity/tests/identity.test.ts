import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IdentityService } from '../src/index';

test('Identity Service securely registers users without storing plaintext passwords', async () => {
  const service = new IdentityService();
  const email = 'WADE_OPERATOR@wadelabs.com';
  const plaintextPassword = 'MySecretSecurePassword123!';

  const user = await service.registerUser(email, plaintextPassword);

  assert.equal(user.email, email.toLowerCase(), 'Emails must be normalized and lowercased');
  assert.notEqual(user.passwordHash, plaintextPassword, 'The database must NEVER store plaintext passwords');
  assert.ok(user.salt.length > 0, 'A cryptographically strong unique salt must be generated');
});

test('Identity Service assigns PCI-compliant Stripe Customer IDs', async () => {
  const service = new IdentityService();
  const user = await service.registerUser('wade@wadelabs.com', 'secure_pass_123');

  // To meet PCI compliance, we store ONLY the non-sensitive token reference from Stripe
  assert.ok(user.stripeCustomerId.startsWith('cus_'), 'A secure, non-sensitive Stripe Customer ID must be mapped');
  assert.notEqual(user.stripeCustomerId.length, 0);
});

test('Identity Service successfully authenticates valid credentials', async () => {
  const service = new IdentityService();
  const email = 'user@example.com';
  const password = 'correct_password';

  await service.registerUser(email, password);

  const result = await service.authenticateUser(email, password);
  
  assert.equal(result.success, true, 'Valid password must successfully authenticate');
  assert.ok(result.sessionId, 'A successful session ID must be returned');
});

test('Identity Service securely rejects invalid credentials', async () => {
  const service = new IdentityService();
  const email = 'user2@example.com';

  await service.registerUser(email, 'the_right_password');

  const result = await service.authenticateUser(email, 'the_wrong_password');
  
  assert.equal(result.success, false, 'An incorrect password must fail authentication');
  assert.equal(result.sessionId, undefined, 'No session ID should be issued for failed login');
});
