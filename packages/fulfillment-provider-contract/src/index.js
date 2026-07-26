"use strict";
// This is the core contract for any service that can fulfill ECOS-owned inventory.
// It abstracts the difference between a distributor warehouse and our own.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FulfillmentProviderType = void 0;
var FulfillmentProviderType;
(function (FulfillmentProviderType) {
    FulfillmentProviderType["OWN_WAREHOUSE"] = "OWN_WAREHOUSE";
    FulfillmentProviderType["DISTRIBUTOR"] = "DISTRIBUTOR";
    FulfillmentProviderType["THIRD_PARTY_LOGISTICS"] = "3PL";
})(FulfillmentProviderType || (exports.FulfillmentProviderType = FulfillmentProviderType = {}));
//# sourceMappingURL=index.js.map