export interface ExpectedPredictions {
    decisionId: string;
    predictedDeliveryDays: number;
    predictedWholesaleCostCents: number;
}
export interface ActualExecution {
    orderId: string;
    providerId: string;
    actualDeliveryDays: number;
    actualWholesaleCostCents: number;
    isCancelled: boolean;
}
export declare class OutcomeEngineService {
    /**
     * Evaluates the outcome of a fulfillment execution by comparing actual results
     * against ECOS's original predictions. Calculates the variance and publishes an outcome event.
     */
    evaluateOutcome(actual: ActualExecution, predicted: ExpectedPredictions): Promise<void>;
}
