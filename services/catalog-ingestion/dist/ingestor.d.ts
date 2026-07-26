import { RawCatalogItem, MasterProduct } from './matching';
export declare class CatalogIngestionService {
    private masterProductsList;
    constructor(masterProductsList: MasterProduct[]);
    /**
     * Processes a batch of raw distributor catalog offers, maps them to ECOS products,
     * and publishes events for any successfully matched items.
     */
    processDistributorFeed(providerId: string, rawItems: RawCatalogItem[]): Promise<{
        matchedCount: number;
        draftCount: number;
    }>;
}
