export declare const publisher: {
    publish(domain: string, eventName: string, payload: Record<string, unknown>, correlationId?: string): Promise<void>;
};
