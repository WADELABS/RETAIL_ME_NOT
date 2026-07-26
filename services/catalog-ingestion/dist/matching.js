"use strict";
// Core logic for matching distributor items to ECOS master products.
// Standardizes text to prevent duplicate listings caused by slightly different distributor naming.
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeKey = normalizeKey;
exports.normalizeMpn = normalizeMpn;
exports.findMatchingProduct = findMatchingProduct;
/**
 * Normalizes a string by converting it to lowercase, removing special characters,
 * and stripping unnecessary whitespaces.
 */
function normalizeKey(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Strip all non-alphanumeric characters
        .trim();
}
/**
 * Standardizes a Manufacturer Part Number (MPN).
 * MPNs are highly susceptible to format differences (dashes, spaces, slashes).
 */
function normalizeMpn(mpn) {
    return normalizeKey(mpn);
}
/**
 * Evaluates whether a raw distributor item matches an existing ECOS master product.
 */
function findMatchingProduct(rawItem, masterProducts) {
    const normalizedRawMpn = normalizeMpn(rawItem.mpn);
    const normalizedRawBrand = normalizeKey(rawItem.brand);
    if (!normalizedRawMpn || !normalizedRawBrand) {
        return null; // Cannot match with missing core identifiers
    }
    for (const master of masterProducts) {
        const normalizedMasterMpn = normalizeMpn(master.mpn);
        const normalizedMasterBrand = normalizeKey(master.brandName);
        // If both the standardized MPN and the Brand match, we have a definitive product match.
        if (normalizedRawMpn === normalizedMasterMpn && normalizedRawBrand === normalizedMasterBrand) {
            return master;
        }
    }
    return null;
}
//# sourceMappingURL=matching.js.map