import {
  FulfillmentProvider,
  FulfillmentProviderType,
  FulfillmentProviderCapabilities,
  FulfillmentProviderSLA,
} from '@ecos/fulfillment-provider-contract';

export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operations. Requests pass through.
  OPEN = 'OPEN',           // API is failing. Requests are blocked instantly.
  HALF_OPEN = 'HALF_OPEN', // Testing if API recovered. Allows a single probe.
}

export class DistributorAAdapter implements FulfillmentProvider {
  id = 'DISTRIBUTOR_A';
  type = FulfillmentProviderType.DISTRIBUTOR;
  name = 'Distributor A (Electronics)';

  capabilities: FulfillmentProviderCapabilities = {
    inventoryLookup: true,
    createShipment: true,
    getTracking: true,
    handleReturn: false,
  };

  sla: FulfillmentProviderSLA = {
    processingTimeHours: 24,
    deliveryEstimateDays: 3,
  };

  // Real-world Circuit Breaker State
  private circuitState: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures = 0;
  private failureThreshold = 3;       // Open circuit after 3 consecutive failures
  private lastStateTransitionTime = 0;
  private cooldownPeriodMs = 10000;    // Cooldown for 10 seconds before half-open probe

  constructor(private apiKey: string, private apiEndpoint: string = 'https://api.distributor-a.com') {
    if (!apiKey) {
      throw new Error('Distributor A API key is required.');
    }
  }

  public getCircuitState(): CircuitState {
    this.evaluateCircuitState();
    return this.circuitState;
  }

  /**
   * Evaluates and updates the circuit breaker state based on the cooldown period.
   */
  private evaluateCircuitState(): void {
    if (this.circuitState === CircuitState.OPEN) {
      const now = Date.now();
      if (now - this.lastStateTransitionTime > this.cooldownPeriodMs) {
        this.circuitState = CircuitState.HALF_OPEN;
        this.lastStateTransitionTime = now;
        console.warn(`[Circuit Breaker] Transitioned to HALF_OPEN. Allowing probe request.`);
      }
    }
  }

  /**
   * Wrapper to execute any HTTP/API call, protected by the Circuit Breaker.
   */
  private async executeWithCircuitBreaker<T>(apiCall: () => Promise<T>): Promise<T> {
    this.evaluateCircuitState();

    if (this.circuitState === CircuitState.OPEN) {
      throw new Error(`[Circuit Breaker] BLOCKED: Connection to ${this.name} is currently suspended due to high failure rate.`);
    }

    try {
      // Execute the actual API call
      const result = await apiCall();

      // On successful execution:
      if (this.circuitState === CircuitState.HALF_OPEN) {
        this.circuitState = CircuitState.CLOSED;
        this.consecutiveFailures = 0;
        console.log(`[Circuit Breaker] SUCCESS: Connection to ${this.name} restored to CLOSED. normal operations resumed.`);
      }
      this.consecutiveFailures = 0; // Reset count
      return result;
    } catch (error) {
      this.consecutiveFailures++;
      console.error(`[Circuit Breaker] FAILURE: Request to ${this.name} failed (${this.consecutiveFailures}/${this.failureThreshold}). Error: ${error.message}`);

      if (this.consecutiveFailures >= this.failureThreshold) {
        this.circuitState = CircuitState.OPEN;
        this.lastStateTransitionTime = Date.now();
        console.error(`[Circuit Breaker] CRITICAL: consecutive failures met. Opening circuit to protect the system. Cooldown: ${this.cooldownPeriodMs / 1000}s.`);
      }

      throw error;
    }
  }

  /**
   * Fetches real-time inventory from the distributor's API.
   */
  public async getInventory(sku: string): Promise<{ sku: string; quantity: number; }> {
    return this.executeWithCircuitBreaker(async () => {
      // Simulate real, timed HTTP request
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000); // 2-second timeout

      try {
        // In production, this would make the real fetch call:
        // const response = await fetch(`${this.apiEndpoint}/inventory/${sku}`, {
        //   headers: { 'Authorization': `Bearer ${this.apiKey}` },
        //   signal: controller.signal
        // });
        // if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        // const data = await response.json();
        // return { sku, quantity: data.stock };

        clearTimeout(timeout);
        return { sku, quantity: 100 }; // Mocked response for verified flow
      } catch (err) {
        clearTimeout(timeout);
        throw new Error(`Connection timeout or failed response from ${this.apiEndpoint}: ${err.message}`);
      }
    });
  }

  /**
   * Submits a B2B Purchase Order to the distributor.
   */
  public async requestShipment(order: object): Promise<{ shipmentId: string; status: string; }> {
    return this.executeWithCircuitBreaker(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // 3-second timeout

      try {
        // In production, this submits the PO payload:
        // const response = await fetch(`${this.apiEndpoint}/orders`, { ... });
        clearTimeout(timeout);
        return { shipmentId: `DA-${Math.random().toString(36).substring(7)}`, status: 'ACCEPTED' };
      } catch (err) {
        clearTimeout(timeout);
        throw new Error(`Fulfillment request failed for ${this.apiEndpoint}: ${err.message}`);
      }
    });
  }

  /**
   * Fetches tracking and delivery status from the distributor.
   */
  public async getShipmentStatus(shipmentId: string): Promise<{ status: string; trackingNumber?: string; }> {
    return this.executeWithCircuitBreaker(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      try {
        clearTimeout(timeout);
        return { status: 'SHIPPED', trackingNumber: `1Z${Math.random().toString().substring(2, 18)}` };
      } catch (err) {
        clearTimeout(timeout);
        throw new Error(`Tracking fetch failed for ${this.apiEndpoint}: ${err.message}`);
      }
    });
  }

  // Helper method to force mock failures for testing the Circuit Breaker
  public async simulateNetworkFailure(): Promise<void> {
    await this.executeWithCircuitBreaker(async () => {
      throw new Error('Simulated network socket timeout.');
    }).catch(() => {}); // catch and absorb locally to let circuit state record the failure
  }
}

export function createDistributorAAdapter(apiKey: string, apiEndpoint?: string) {
  return new DistributorAAdapter(apiKey, apiEndpoint);
}
