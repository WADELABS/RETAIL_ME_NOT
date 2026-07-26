"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publisher = void 0;
const in_memory_bus_1 = require("../../../packages/events/src/bus/in-memory-bus");
const uuid_1 = require("uuid");
// In a real application, you would inject the desired event bus implementation.
const eventBus = in_memory_bus_1.inMemoryEventBus;
// The publisher service provides a single, consistent way for other services
// to publish events to the bus. It handles enriching the event with metadata.
exports.publisher = {
    async publish(domain, eventName, payload, correlationId) {
        const event = {
            eventId: (0, uuid_1.v4)(),
            correlationId: correlationId || (0, uuid_1.v4)(),
            timestamp: new Date().toISOString(),
            version: '1.0', // This would come from the event schema definition
            domain,
            eventName,
            payload,
        };
        await eventBus.publish(event);
    }
};
//# sourceMappingURL=index.js.map