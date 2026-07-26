export declare enum FulfillmentProviderType {
    OWN_WAREHOUSE = "OWN_WAREHOUSE",
    DISTRIBUTOR = "DISTRIBUTOR",
    THIRD_PARTY_LOGISTICS = "3PL"
}
export interface FulfillmentProviderCapabilities {
    inventoryLookup: boolean;
    createShipment: boolean;
    getTracking: boolean;
    handleReturn: boolean;
}
export interface FulfillmentProviderSLA {
    processingTimeHours: number;
    deliveryEstimateDays: number;
}
export interface FulfillmentProvider {
    id: string;
    type: FulfillmentProviderType;
    name: string;
    capabilities: FulfillmentProviderCapabilities;
    sla: FulfillmentProviderSLA;
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
