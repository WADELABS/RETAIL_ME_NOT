export declare const consumer: {
    subscribe<TPayload>(domain: string, eventName: string, schema: any, handler: (payload: TPayload) => void | Promise<void>): void;
};
