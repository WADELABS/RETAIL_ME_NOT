import { publisher } from '../../event-gateway/publisher/index';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

export interface UserRecord {
  userId: string;
  email: string;
  passwordHash: string;
  salt: string;
  stripeCustomerId: string;
}

export class IdentityService {
  // In-memory user database (simulating PostgreSQL)
  private users: Map<string, UserRecord> = new Map();

  /**
   * Generates a secure, cryptographically strong random salt.
   */
  public generateSalt(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Hashes a password securely using Node's native scrypt algorithm.
   */
  public hashPassword(password: string, salt: string): string {
    // scrypt is a key-derivation function specifically designed to resist brute-force hardware attacks
    return scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  }

  /**
   * Securely registers a new customer.
   * Hashes the password, tokenizes the card via Stripe (simulated), and stores NO raw card data.
   */
  public async registerUser(email: string, passwordPlaintext: string): Promise<UserRecord> {
    const salt = this.generateSalt();
    const passwordHash = this.hashPassword(passwordPlaintext, salt);
    const userId = uuidv4();

    // PCI-DSS Compliance Action:
    // We call the Stripe API to register the customer and store ONLY their secure Stripe Customer ID.
    // e.g., const customer = await stripe.customers.create({ email });
    const stripeCustomerId = `cus_${Math.random().toString(36).substring(2, 14)}`;

    const user: UserRecord = {
      userId,
      email: email.toLowerCase().trim(),
      passwordHash,
      salt,
      stripeCustomerId,
    };

    this.users.set(user.email, user);
    console.log(`[Identity Service] Registered user: ${email}. Secure Stripe Customer ID generated: ${stripeCustomerId}`);

    // Publish the customer.registered event
    await publisher.publish(
      'identity',
      'customer.registered',
      {
        customerId: userId,
        email: user.email,
        stripeCustomerId,
        registeredAt: new Date().toISOString(),
      }
    );

    return user;
  }

  /**
   * Authenticates a user securely.
   * Defends against timing attacks by using constant-time timingSafeEqual for hash verification.
   */
  public async authenticateUser(email: string, passwordPlaintext: string): Promise<{ success: boolean; sessionId?: string; userId?: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = this.users.get(normalizedEmail);

    if (!user) {
      console.warn(`[Security Warning] Authentication failed: User not found: ${normalizedEmail}`);
      return { success: false };
    }

    // Hash the input password using the exact same salt
    const computedHash = this.hashPassword(passwordPlaintext, user.salt);

    // Constant-time comparison to prevent side-channel timing analysis
    const expectedBuffer = Buffer.from(user.passwordHash, 'hex');
    const actualBuffer = Buffer.from(computedHash, 'hex');

    const isValid = timingSafeEqual(expectedBuffer, actualBuffer);

    if (!isValid) {
      console.warn(`[Security Warning] Authentication failed: Password mismatch for ${normalizedEmail}`);
      return { success: false };
    }

    const sessionId = uuidv4();
    console.log(`[Identity Service] SUCCESS: Authenticated user: ${normalizedEmail}. Session: ${sessionId}`);

    // Publish customer.authenticated event
    await publisher.publish(
      'identity',
      'customer.authenticated',
      {
        customerId: user.userId,
        email: user.email,
        sessionId,
        authenticatedAt: new Date().toISOString(),
      }
    );

    return { success: true, sessionId, userId: user.userId };
  }

  public getUser(email: string): UserRecord | undefined {
    return this.users.get(email.toLowerCase().trim());
  }
}
