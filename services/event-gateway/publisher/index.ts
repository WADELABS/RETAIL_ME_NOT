import { inMemoryEventBus } from '../../../packages/events/src/bus/in-memory-bus';
import { EcosEvent, IEventBus } from '../../../packages/events/src/bus/interface';
import { v4 as uuidv4 } from 'uuid';

// In a real application, you would inject the desired event bus implementation.
const eventBus: IEventBus = inMemoryEventBus;

// The publisher service provides a single, consistent way for other services
// to publish events to the bus. It handles enriching the event with metadata.
export const publisher = {
  async publish(
    domain: string,
    eventName: string,
    payload: Record<string, unknown>,
    correlationId?: string
  ): Promise<void> {
    const event: EcosEvent = {
      eventId: uuidv4(),
      correlationId: correlationId || uuidv4(),
      timestamp: new Date().toISOString(),
      version: '1.0', // This would come from the event schema definition
      domain,
      eventName,
      payload,
    };
    
    await eventBus.publish(event);
  }
};
