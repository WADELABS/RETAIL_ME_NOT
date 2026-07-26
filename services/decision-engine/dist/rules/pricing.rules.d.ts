export declare const pricingRules: {
    name: string;
    condition: (context: any) => boolean;
    consequence: {
        decision: string;
        reason: string;
        confidence: number;
    };
}[];
