// This service aggregates inventory from multiple physical and virtual fulfillment nodes.
// It builds a real-time availability graph instead of storing a single static count.

export interface InventoryNode {
  providerId: string; // e.g., 'DISTRIBUTOR_A', 'WAREHOUSE_EAST'
  providerType: 'OWN_WAREHOUSE' | 'DISTRIBUTOR' | '3PL';
  rawQuantity: number;
  providerReliabilityScore: number; // Dynamic reliability (0-1) from Supplier Intelligence
}

export interface AvailabilityGraph {
  sku: string;
  totalRawQuantity: number;
  weightedConfidenceScore: number; // Blended availability score (0-1)
  nodes: InventoryNode[];
}

export class InventoryAvailabilityService {
  /**
   * Builds the availability graph for a given SKU based on reported inventory nodes.
   */
  public getAvailabilityGraph(sku: string, nodes: InventoryNode[]): AvailabilityGraph {
    const totalRawQuantity = nodes.reduce((sum, node) => sum + node.rawQuantity, 0);

    if (totalRawQuantity === 0) {
      return {
        sku,
        totalRawQuantity: 0,
        weightedConfidenceScore: 0,
        nodes: [],
      };
    }

    // Weighted confidence score = SUM(node.quantity * node.reliability) / SUM(node.quantity)
    const weightedSum = nodes.reduce(
      (sum, node) => sum + (node.rawQuantity * node.providerReliabilityScore),
      0
    );
    const weightedConfidenceScore = parseFloat((weightedSum / totalRawQuantity).toFixed(4));

    return {
      sku,
      totalRawQuantity,
      weightedConfidenceScore,
      nodes: nodes.sort((a, b) => b.rawQuantity - a.rawQuantity), // Sort nodes by largest volume first
    };
  }
}
