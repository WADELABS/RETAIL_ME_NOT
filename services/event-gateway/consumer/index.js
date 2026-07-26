"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consumer = void 0;
const in_memory_bus_1 = require("../../../packages/events/src/bus/in-memory-bus");
// In a real application, you would inject the desired event bus implementation.
const eventBus = in_memory_bus_1.inMemoryEventBus;
// The consumer service provides a consistent, schema-validated way for other
// services to subscribe to events.
exports.consumer = {
    subscribe(domain, eventName, schema, // Decouples schema generic to allow distinct payload typing
    handler) {
        const fullEventName = `${domain}.${eventName}`;
        const validatedHandler = async (event) => {
            const validationResult = schema.safeParse(event);
            if (!validationResult.success) {
                console.error(`[Event Consumer] Invalid event received for ${fullEventName}:`, validationResult.error);
                // In a real system, this would go to a dead-letter queue.
                return;
            }
            // Pass only the validated payload to the handler, casting safely to TPayload
            const payload = validationResult.data.payload;
            await handler(payload);
        };
        eventBus.subscribe(fullEventName, validatedHandler);
    }
};
//# sourceMappingURL=index.js.map