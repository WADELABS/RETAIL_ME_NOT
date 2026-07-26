import { inMemoryEventBus } from '../../../packages/events/src/bus/in-memory-bus';
import { IEventBus, EventHandler } from '../../../packages/events/src/bus/interface';

// In a real application, you would inject the desired event bus implementation.
const eventBus: IEventBus = inMemoryEventBus;

// The consumer service provides a consistent, schema-validated way for other
// services to subscribe to events.
export const consumer = {
  subscribe<TPayload>(
    domain: string,
    eventName: string,
    schema: any, // Decouples schema generic to allow distinct payload typing
    handler: (payload: TPayload) => void | Promise<void>
  ): void {
    
    const fullEventName = `${domain}.${eventName}`;

    const validatedHandler: EventHandler = async (event) => {
      const validationResult = schema.safeParse(event);
      if (!validationResult.success) {
        console.error(`[Event Consumer] Invalid event received for ${fullEventName}:`, validationResult.error);
        // In a real system, this would go to a dead-letter queue.
        return;
      }
      
      // Pass only the validated payload to the handler, casting safely to TPayload
      const payload = (validationResult.data as any).payload as TPayload;
      await handler(payload);
    };

    eventBus.subscribe(fullEventName, validatedHandler);
  }
};
