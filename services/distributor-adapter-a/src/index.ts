import {
  FulfillmentProvider,
  FulfillmentProviderType,
  FulfillmentProviderCapabilities,
  FulfillmentProviderSLA,
} from '@ecos/fulfillment-provider-contract';

class DistributorAAdapter implements FulfillmentProvider {
  id = 'DISTRIBUTOR_A';
  type = FulfillmentProviderType.DISTRIBUTOR;
  name = 'Distributor A (Electronics)';

  capabilities: FulfillmentProviderCapabilities = {
    inventoryLookup: true,
    createShipment: true,
    getTracking: true,
    handleReturn: false, // This distributor does not handle returns
  };

  sla: FulfillmentProviderSLA = {
    processingTimeHours: 24,
    deliveryEstimateDays: 3,
  };

  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('Distributor A API key is required.');
    }
  }

  // Example implementation of the getInventory method
  async getInventory(sku: string): Promise<{ sku: string; quantity: number; }> {
    console.log(`[Distributor A] Fetching inventory for SKU: ${sku}`);
    // const response = await fetch(`https://api.distributor-a.com/inventory/${sku}`, {
    //   headers: { 'Authorization': `Bearer ${this.apiKey}` }
    // });
    // const data = await response.json();
    // return { sku, quantity: data.stock };

    // Placeholder data:
    return Promise.resolve({ sku, quantity: 100 });
  }

  async requestShipment(order: object): Promise<{ shipmentId: string; status: string; }> {
    console.log(`[Distributor A] Requesting shipment for order...`);
    // const response = await fetch(`https://api.distributor-a.com/orders`, {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${this.apiKey}` },
    //   body: JSON.stringify(order) // This would be a transformed ECOS order -> PO
    // });
    // const data = await response.json();
    // return { shipmentId: data.distributorOrderId, status: 'ACCEPTED' };

    // Placeholder data:
    return Promise.resolve({ shipmentId: `DA-${Math.random().toString(36).substring(7)}`, status: 'ACCEPTED' });
  }

  async getShipmentStatus(shipmentId: string): Promise<{ status: string; trackingNumber?: string; }> {
    console.log(`[Distributor A] Fetching status for shipment: ${shipmentId}`);
    // const response = await fetch(`https://api.distributor-a.com/orders/${shipmentId}/status`, {
    //   headers: { 'Authorization': `Bearer ${this.apiKey}` }
    // });
    // const data = await response.json();
    // return { status: data.status, trackingNumber: data.tracking };

    // Placeholder data:
    return Promise.resolve({ status: 'SHIPPED', trackingNumber: `1Z${Math.random().toString().substring(2, 18)}` });
  }
}

// Export a factory function to create instances of the adapter
export function createDistributorAAdapter(apiKey: string) {
  return new DistributorAAdapter(apiKey);
}
