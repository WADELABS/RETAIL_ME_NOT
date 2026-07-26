"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogIngestionService = void 0;
const index_1 = require("../../event-gateway/publisher/index");
const matching_1 = require("./matching");
const uuid_1 = require("uuid");
class CatalogIngestionService {
    masterProductsList;
    constructor(masterProductsList) {
        this.masterProductsList = masterProductsList;
    }
    /**
     * Processes a batch of raw distributor catalog offers, maps them to ECOS products,
     * and publishes events for any successfully matched items.
     */
    async processDistributorFeed(providerId, rawItems) {
        console.log(`[Catalog Ingestion] Ingesting feed from provider: ${providerId}. Total items: ${rawItems.length}`);
        let matchedCount = 0;
        let draftCount = 0;
        for (const rawItem of rawItems) {
            const match = (0, matching_1.findMatchingProduct)(rawItem, this.masterProductsList);
            if (match) {
                matchedCount++;
                console.log(`[Catalog Ingestion] SUCCESS: Matched distributor item "${rawItem.title}" to ECOS Master SKU: ${match.sku}`);
                // Publish an event indicating that an active offer has been matched/updated
                await index_1.publisher.publish('catalog', 'product.matched', {
                    sku: match.sku,
                    providerId,
                    distributorSku: rawItem.distributorSku,
                    wholesaleCostCents: rawItem.wholesaleCostCents,
                    matchedAt: new Date().toISOString(),
                });
            }
            else {
                draftCount++;
                console.log(`[Catalog Ingestion] UNMATCHED: Creating DRAFT product for manual review: "${rawItem.title}" (MPN: ${rawItem.mpn})`);
                // Publish a draft event prompting the PIM domain to queue this for manual catalog enrichment
                await index_1.publisher.publish('catalog', 'draft.created', {
                    draftId: (0, uuid_1.v4)(),
                    suggestedTitle: rawItem.title,
                    suggestedBrand: rawItem.brand,
                    suggestedMpn: rawItem.mpn,
                    providerId,
                    wholesaleCostCents: rawItem.wholesaleCostCents,
                    createdAt: new Date().toISOString(),
                });
            }
        }
        console.log(`[Catalog Ingestion] Ingestion complete. Matched: ${matchedCount}. Drafts (Unmatched): ${draftCount}`);
        return { matchedCount, draftCount };
    }
}
exports.CatalogIngestionService = CatalogIngestionService;
//# sourceMappingURL=ingestor.js.map