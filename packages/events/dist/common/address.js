"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressSchema = void 0;
const zod_1 = require("zod");
exports.AddressSchema = zod_1.z.object({
    recipientName: zod_1.z.string().min(1),
    line1: zod_1.z.string().min(1),
    line2: zod_1.z.string().optional().nullable(),
    city: zod_1.z.string().min(1),
    state: zod_1.z.string().min(1),
    postalCode: zod_1.z.string().min(1),
    country: zod_1.z.string().length(2), // ISO 3166-1 alpha-2 country code
});
//# sourceMappingURL=address.js.map