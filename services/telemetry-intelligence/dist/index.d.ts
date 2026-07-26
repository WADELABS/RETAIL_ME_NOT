export declare class TelemetryIntelligenceService {
    private telemetryState;
    initialize(): void;
    private recordSearch;
    private recordCartAdd;
    private getOrCreateState;
    /**
     * Computes the rolling Demand Velocity Score.
     * Cart additions represent absolute buying intent, so they are weighted heavily.
     * Formula: Demand Score = Searches + (CartAdditions * 5)
     */
    private evaluateDemandSpike;
}
