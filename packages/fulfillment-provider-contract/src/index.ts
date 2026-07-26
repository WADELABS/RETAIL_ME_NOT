// This is the core contract for any service that can fulfill ECOS-owned inventory.
// It abstracts the difference between a distributor warehouse and our own.

export enum FulfillmentProviderType {
  OWN_WAREHOUSE = 'OWN_WAREHOUSE',
  DISTRIBUTOR = 'DISTRIBUTOR',
  THIRD_PARTY_LOGISTICS = '3PL',
}

export interface FulfillmentProviderCapabilities {
  inventoryLookup: boolean; // Can we query real-time inventory?
  createShipment: boolean;  // Can we programmatically create a shipment?
  getTracking: boolean;     // Does it provide tracking numbers via API?
  handleReturn: boolean;    // Does it accept returns on our behalf?
}

export interface FulfillmentProviderSLA {
  processingTimeHours: number;    // Time from order receipt to shipment
  deliveryEstimateDays: number; // Average delivery time
}

export interface FulfillmentProvider {
  id: string; // e.g., 'DISTRIBUTOR_A' or 'WAREHOUSE_EAST_01'
  type: FulfillmentProviderType;
  name: string;
  capabilities: FulfillmentProviderCapabilities;
  sla: FulfillmentProviderSLA;

  // Methods that an adapter for this provider must implement
  getInventory(sku: string): Promise<{ sku: string, quantity: number }>;
  requestShipment(order: object): Promise<{ shipmentId: string, status: string }>;
  getShipmentStatus(shipmentId: string): Promise<{ status: string, trackingNumber?: string }>;
}
