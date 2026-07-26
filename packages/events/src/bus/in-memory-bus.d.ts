import { IEventBus, EcosEvent, EventHandler } from './interface';
declare class InMemoryEventBus implements IEventBus {
    private subscribers;
    publish(event: EcosEvent): Promise<void>;
    subscribe(eventName: string, handler: EventHandler): void;
}
export declare const inMemoryEventBus: InMemoryEventBus;
export {};
