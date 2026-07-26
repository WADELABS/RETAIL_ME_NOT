export interface InventoryNode {
    providerId: string;
    providerType: 'OWN_WAREHOUSE' | 'DISTRIBUTOR' | '3PL';
    rawQuantity: number;
    providerReliabilityScore: number;
}
export interface AvailabilityGraph {
    sku: string;
    totalRawQuantity: number;
    weightedConfidenceScore: number;
    nodes: InventoryNode[];
}
export declare class InventoryAvailabilityService {
    /**
     * Builds the availability graph for a given SKU based on reported inventory nodes.
     */
    getAvailabilityGraph(sku: string, nodes: InventoryNode[]): AvailabilityGraph;
}
