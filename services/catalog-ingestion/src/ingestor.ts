import { publisher } from '../../event-gateway/publisher/index';
import { RawCatalogItem, MasterProduct, findMatchingProduct } from './matching';
import { v4 as uuidv4 } from 'uuid';

export class CatalogIngestionService {
  constructor(private masterProductsList: MasterProduct[]) {}

  /**
   * Processes a batch of raw distributor catalog offers, maps them to ECOS products,
   * and publishes events for any successfully matched items.
   */
  public async processDistributorFeed(
    providerId: string,
    rawItems: RawCatalogItem[]
  ): Promise<{ matchedCount: number; draftCount: number }> {
    console.log(`[Catalog Ingestion] Ingesting feed from provider: ${providerId}. Total items: ${rawItems.length}`);

    let matchedCount = 0;
    let draftCount = 0;

    for (const rawItem of rawItems) {
      const match = findMatchingProduct(rawItem, this.masterProductsList);

      if (match) {
        matchedCount++;
        console.log(`[Catalog Ingestion] SUCCESS: Matched distributor item "${rawItem.title}" to ECOS Master SKU: ${match.sku}`);

        // Publish an event indicating that an active offer has been matched/updated
        await publisher.publish(
          'catalog',
          'product.matched',
          {
            sku: match.sku,
            providerId,
            distributorSku: rawItem.distributorSku,
            wholesaleCostCents: rawItem.wholesaleCostCents,
            matchedAt: new Date().toISOString(),
          }
        );
      } else {
        draftCount++;
        console.log(`[Catalog Ingestion] UNMATCHED: Creating DRAFT product for manual review: "${rawItem.title}" (MPN: ${rawItem.mpn})`);

        // Publish a draft event prompting the PIM domain to queue this for manual catalog enrichment
        await publisher.publish(
          'catalog',
          'draft.created',
          {
            draftId: uuidv4(),
            suggestedTitle: rawItem.title,
            suggestedBrand: rawItem.brand,
            suggestedMpn: rawItem.mpn,
            providerId,
            wholesaleCostCents: rawItem.wholesaleCostCents,
            createdAt: new Date().toISOString(),
          }
        );
      }
    }

    console.log(`[Catalog Ingestion] Ingestion complete. Matched: ${matchedCount}. Drafts (Unmatched): ${draftCount}`);
    return { matchedCount, draftCount };
  }
}
