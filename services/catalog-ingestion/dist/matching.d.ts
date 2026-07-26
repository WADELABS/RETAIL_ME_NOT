export interface RawCatalogItem {
    distributorSku: string;
    title: string;
    brand: string;
    mpn: string;
    wholesaleCostCents: number;
}
export interface MasterProduct {
    sku: string;
    brandName: string;
    mpn: string;
}
/**
 * Normalizes a string by converting it to lowercase, removing special characters,
 * and stripping unnecessary whitespaces.
 */
export declare function normalizeKey(text: string): string;
/**
 * Standardizes a Manufacturer Part Number (MPN).
 * MPNs are highly susceptible to format differences (dashes, spaces, slashes).
 */
export declare function normalizeMpn(mpn: string): string;
/**
 * Evaluates whether a raw distributor item matches an existing ECOS master product.
 */
export declare function findMatchingProduct(rawItem: RawCatalogItem, masterProducts: MasterProduct[]): MasterProduct | null;
