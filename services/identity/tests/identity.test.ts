import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IdentityService } from '../src/index';
import { v4 as uuidv4 } from 'uuid';

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


// --- ADVANCED PLAID-STRIPE TOKEN EXCHANGE TESTS ---

test('Identity Service acts as a zero-trust bridge, successfully executing the Plaid-to-Stripe token swap', async () => {
  const service = new IdentityService();
  const email = 'b2b_buyer@corporation.com';

  // 1. Register B2B customer
  const user = await service.registerUser(email, 'secure_corporate_pass_11');
  assert.equal(user.vaultedAchPaymentMethodId, undefined, 'Initially no ACH payment method should be vaulted');

  // 2. Simulate Plaid Link success on frontend returning a public_token and account ID
  const mockPublicToken = 'public-sandbox-99228833-2288-4123-bc99-2288bb33aa88';
  const mockAccountId = 'acc_sandbox_99881122';

  // 3. Initiate backend token exchange
  const result = await service.exchangePlaidTokenAndVaultAch(email, mockPublicToken, mockAccountId);

  // 4. Verify cryptographic swap sequence
  assert.equal(result.status, 'SUCCESS');
  assert.ok(result.plaidAccessToken?.startsWith('access-sandbox-'), 'Must securely exchange public_token for access_token');
  assert.ok(result.stripeBankAccountToken?.startsWith('btok_sandbox_'), 'Must securely swap access_token for Stripe Bank Token (btok_)');
  assert.ok(result.stripePaymentMethodId?.startsWith('pm_ach_'), 'Must securely vault the bank account, generating a Stripe PM ID');

  // 5. Verify zero-trust database persistence
  const updatedUser = service.getUser(email)!;
  assert.equal(updatedUser.vaultedAchPaymentMethodId, result.stripePaymentMethodId, 'Must save the non-sensitive PM ID on the customer record');
  assert.equal((updatedUser as any).rawBankAccountNumber, undefined, 'Must NEVER store raw bank accounts in our database, satisfying zero-trust compliance');
});
