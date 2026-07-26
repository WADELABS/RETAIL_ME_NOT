import { IEventBus, EcosEvent, EventHandler } from './interface';

// A simple in-memory event bus for local development and testing.
// It simulates the publish-subscribe pattern without needing external infrastructure.
class InMemoryEventBus implements IEventBus {
  private subscribers: Map<string, EventHandler[]> = new Map();

  public publish(event: EcosEvent): Promise<void> {
    const eventName = `${event.domain}.${event.eventName}`;
    console.log(`[InMemoryEventBus] Publishing event: ${eventName}`, event);
    const handlers = this.subscribers.get(eventName) || [];
    
    handlers.forEach(async handler => {
      try {
        // We don't await the publish to simulate the async, fire-and-forget nature of a real event bus
        await handler(event);
      } catch (error) {
        console.error(`[InMemoryEventBus] Error in handler for ${eventName}:`, error);
        // In a real implementation, this would trigger a dead-letter queue or retry logic.
      }
    });

    return Promise.resolve();
  }

  public subscribe(eventName: string, handler: EventHandler): void {
    console.log(`[InMemoryEventBus] New subscription for: ${eventName}`);
    const existingHandlers = this.subscribers.get(eventName) || [];
    this.subscribers.set(eventName, [...existingHandlers, handler]);
  }
}

// Export a singleton instance to be shared across the application in a non-production environment.
export const inMemoryEventBus = new InMemoryEventBus();
