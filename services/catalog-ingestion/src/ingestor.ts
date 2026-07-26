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


  // --- 2. BULK PRODUCT FEED PARSER (CSV / API) ---

  /**
   * Programmatically parses a raw, flat-text CSV file containing bulk vendor product updates,
   * normalizes columns, and triggers active SKU mapping.
   *
   * Expected CSV Format:
   * distributorSku,title,brand,mpn,wholesaleCostCents
   * DA-5522,"Nvidia GeForce RTX 5070 Ti Graphics Card",Nvidia,RTX5070TI-WADE,68000
   */
  public async parseBulkCsvFeed(
    providerId: string,
    csvString: string
  ): Promise<{ parsedCount: number; matchedCount: number; draftCount: number }> {
    console.log(`[Catalog Ingestion] Parsing bulk CSV feed from provider: ${providerId}...`);

    const lines = csvString.trim().split('\n');
    if (lines.length <= 1) {
      console.warn('[Catalog Ingestion Warning] Empty or header-only CSV feed received.');
      return { parsedCount: 0, matchedCount: 0, draftCount: 0 };
    }

    // Extract headers (first line) and normalize them to lower-case
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    const rawItems: RawCatalogItem[] = [];

    // Loop through rows (skip header row)
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].trim();
      if (!row) continue; // Skip empty rows

      // Handle simple CSV splitting (supporting simple quoted values)
      const values = row.split(',').map(val => {
        // Strip leading/trailing quotes if present
        return val.trim().replace(/^"|"$/g, '');
      });

      if (values.length !== headers.length) {
        console.warn(`[Catalog Ingestion Warning] Skipping malformed CSV row ${i}: Expected ${headers.length} columns, got ${values.length}`);
        continue;
      }

      // Map columns dynamically based on header index
      const item: any = {};
      headers.forEach((header, index) => {
        item[header] = values[index];
      });

      // Construct and validate the RawCatalogItem
      const rawItem: RawCatalogItem = {
        distributorSku: item.distributorsku || `DA-${uuidv4().substring(0, 6).toUpperCase()}`,
        title: item.title || 'Unknown Product',
        brand: item.brand || 'Generic',
        mpn: item.mpn || '',
        wholesaleCostCents: parseInt(item.wholesalecostcents || '0', 10),
      };

      rawItems.push(rawItem);
    }

    console.log(`[Catalog Ingestion] Successfully parsed ${rawItems.length} records from CSV.`);

    // Run the matched items batch loop
    const results = await this.processDistributorFeed(providerId, rawItems);

    return {
      parsedCount: rawItems.length,
      matchedCount: results.matchedCount,
      draftCount: results.draftCount,
    };
  }
}
