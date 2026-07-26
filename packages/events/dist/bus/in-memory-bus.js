"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inMemoryEventBus = void 0;
// A simple in-memory event bus for local development and testing.
// It simulates the publish-subscribe pattern without needing external infrastructure.
class InMemoryEventBus {
    subscribers = new Map();
    publish(event) {
        const eventName = `${event.domain}.${event.eventName}`;
        console.log(`[InMemoryEventBus] Publishing event: ${eventName}`, event);
        const handlers = this.subscribers.get(eventName) || [];
        handlers.forEach(async (handler) => {
            try {
                // We don't await the publish to simulate the async, fire-and-forget nature of a real event bus
                await handler(event);
            }
            catch (error) {
                console.error(`[InMemoryEventBus] Error in handler for ${eventName}:`, error);
                // In a real implementation, this would trigger a dead-letter queue or retry logic.
            }
        });
        return Promise.resolve();
    }
    subscribe(eventName, handler) {
        console.log(`[InMemoryEventBus] New subscription for: ${eventName}`);
        const existingHandlers = this.subscribers.get(eventName) || [];
        this.subscribers.set(eventName, [...existingHandlers, handler]);
    }
}
// Export a singleton instance to be shared across the application in a non-production environment.
exports.inMemoryEventBus = new InMemoryEventBus();
//# sourceMappingURL=in-memory-bus.js.map