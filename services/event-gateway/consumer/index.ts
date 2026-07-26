import { inMemoryEventBus } from '@ecos/events/bus/in-memory-bus';
import { IEventBus, EventHandler } from '@ecos/events/bus/interface';
import { ZodSchema } from 'zod';

// In a real application, you would inject the desired event bus implementation.
const eventBus: IEventBus = inMemoryEventBus;

// The consumer service provides a consistent, schema-validated way for other
// services to subscribe to events.
export const consumer = {
  subscribe<T>(
    domain: string,
    eventName: string,
    schema: ZodSchema<T>,
    handler: (payload: T) => void | Promise<void>
  ): void {
    
    const fullEventName = `${domain}.${eventName}`;

    const validatedHandler: EventHandler = async (event) => {
      const validationResult = schema.safeParse(event);
      if (!validationResult.success) {
        console.error(`[Event Consumer] Invalid event received for ${fullEventName}:`, validationResult.error);
        // In a real system, this would go to a dead-letter queue.
        return;
      }
      
      // Pass only the validated payload to the handler
      await handler(validationResult.data.payload);
    };

    eventBus.subscribe(fullEventName, validatedHandler);
  }
};
