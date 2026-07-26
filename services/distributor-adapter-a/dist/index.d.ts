import { FulfillmentProvider, FulfillmentProviderType, FulfillmentProviderCapabilities, FulfillmentProviderSLA } from '@ecos/fulfillment-provider-contract';
declare class DistributorAAdapter implements FulfillmentProvider {
    private apiKey;
    id: string;
    type: FulfillmentProviderType;
    name: string;
    capabilities: FulfillmentProviderCapabilities;
    sla: FulfillmentProviderSLA;
    constructor(apiKey: string);
    getInventory(sku: string): Promise<{
        sku: string;
        quantity: number;
    }>;
    requestShipment(order: object): Promise<{
        shipmentId: string;
        status: string;
    }>;
    getShipmentStatus(shipmentId: string): Promise<{
        status: string;
        trackingNumber?: string;
    }>;
}
export declare function createDistributorAAdapter(apiKey: string): DistributorAAdapter;
export {};
