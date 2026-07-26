export interface EcosEvent {
    eventId: string;
    correlationId: string;
    timestamp: string;
    version: string;
    domain: string;
    eventName: string;
    payload: Record<string, unknown>;
}
export type EventHandler = (event: EcosEvent) => void | Promise<void>;
export interface IEventBus {
    publish(event: EcosEvent): Promise<void>;
    subscribe(eventName: string, handler: EventHandler): void;
}
