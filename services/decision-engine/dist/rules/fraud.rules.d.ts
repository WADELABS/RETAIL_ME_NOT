export declare const fraudRules: {
    name: string;
    condition: (context: any) => boolean;
    consequence: {
        decision: string;
        reason: string;
        confidence: number;
    };
}[];
