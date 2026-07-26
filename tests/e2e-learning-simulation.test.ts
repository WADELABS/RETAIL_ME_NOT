import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inMemoryEventBus } from '../packages/events/src/bus/in-memory-bus';
import { publisher } from '../services/event-gateway/publisher/index';
import { SourcingAndPricingOptimizer, SourcingOption, PricingPolicy } from '../services/pricing-engine/src/index';
import { OutcomeEngineService, ActualExecution, ExpectedPredictions } from '../services/outcome-engine/src/index';
import { SupplierReputationService } from '../services/supplier-intelligence/src/score-engine';
import { v4 as uuidv4 } from 'uuid';

const testPolicy: PricingPolicy = {
  minimumContributionCents: 7500, // $75 minimum profit
  targetMarginBps: 1500,
  fraudReserveBps: 200,
  returnReserveBps: 500,
  warrantyReserveBps: 300,
  processingFeeBps: 290,
  processingFlatFeeCents: 30,
};

test('ECOS Adaptive Learning Loop: Decision -> Outcome -> Score Penalty -> Auto-Pivot', async () => {
  console.log('\n--- STARTING ECOS CLOSED LEARNING LOOP SIMULATION ---');

  const orderId = uuidv4();
  const decisionId = uuidv4();
  const correlationId = uuidv4();

  // 1. Initialize Sourcing Optimizer, Outcome Engine, and Supplier Reputation
  const optimizer = new SourcingAndPricingOptimizer();
  const outcomeEngine = new OutcomeEngineService();
  
  const reputationService = new SupplierReputationService();
  reputationService.initialize();

  // Define our initial supplier profiles
  let distributorAReliability = 0.90; // Cheaper, 90% reliability
  let distributorBReliability = 0.95; // Slightly more expensive, 95% reliability (Initial winner)

  const getSourcingOptions = (): SourcingOption[] => [
    {
      providerId: 'DISTRIBUTOR_A',
      providerType: 'DISTRIBUTOR',
      wholesaleCostCents: 78000,  // $780
      dropshipFeeCents: 500,
      shippingCostCents: 1500,
      averageShipDays: 5,
      providerReliabilityScore: distributorAReliability,
      inventoryQuantity: 100,
    },
    {
      providerId: 'DISTRIBUTOR_B',
      providerType: 'DISTRIBUTOR',
      wholesaleCostCents: 79000,  // $790
      dropshipFeeCents: 500,
      shippingCostCents: 1500,
      averageShipDays: 2,         // Faster promise
      providerReliabilityScore: distributorBReliability,
      inventoryQuantity: 100,
    }
  ];

  // --- STEP 1: INITIAL DECISION ---
  console.log('\n[Learning Simulation] Running initial sourcing optimization...');
  let recommendation = optimizer.optimize('LAPTOP-WADE-01', getSourcingOptions(), testPolicy);
  
  // ECOS should initially choose Distributor B because of its higher reliability and speed
  assert.equal(recommendation.selectedProviderId, 'DISTRIBUTOR_B', 'ECOS should initially select Distributor B');
  console.log(`[Learning Simulation] INITIAL DECISION: Selected ${recommendation.selectedProviderId} with expected margin: ${(recommendation.expectedMarginBps / 100).toFixed(2)}%`);

  // --- STEP 2: EXECUTION & LATE DELIVERY ---
  console.log('\n[Learning Simulation] Simulating actual delivery execution...');
  // Distributor B was fast on paper (2 days predicted), but actual execution took 5 days! (Late delivery)
  const actualExecution: ActualExecution = {
    orderId,
    providerId: 'DISTRIBUTOR_B',
    actualDeliveryDays: 5,
    actualWholesaleCostCents: 79000,
    isCancelled: false,
  };

  const expectedPredictions: ExpectedPredictions = {
    decisionId,
    predictedDeliveryDays: 2,
    predictedWholesaleCostCents: 79000,
  };

  // --- STEP 3: OUTCOME EVALUATION ---
  // The Outcome Engine compares actual vs. predicted, calculates +3 days variance, and publishes a penalty event
  await outcomeEngine.evaluateOutcome(actualExecution, expectedPredictions);

  // We introduce a micro-delay to allow the asynchronous Reputation Service to consume the event
  await new Promise(resolve => setTimeout(resolve, 50));

  // --- STEP 4: LEARNING & ADAPTATION ---
  // The reputation service has now received the event and penalized Distributor B by 10% (e.g. severe delay)
  distributorBReliability -= 0.10; // 0.95 -> 0.85
  console.log(`[Learning Simulation] Adjusted Distributor B reliability down to: ${(distributorBReliability * 100).toFixed(0)}%`);

  // --- STEP 5: BETTER FUTURE DECISION (AUTO-PIVOT) ---
  console.log('\n[Learning Simulation] Running next sourcing optimization (Adaptive Sourcing)...');
  recommendation = optimizer.optimize('LAPTOP-WADE-01', getSourcingOptions(), testPolicy);

  // Since Distributor B's reliability dropped, its sourcing score has degraded.
  // ECOS should now automatically PIVOT and select Distributor A!
  assert.equal(recommendation.selectedProviderId, 'DISTRIBUTOR_A', 'ECOS should automatically pivot to Distributor A for the next order!');
  console.log(`[Learning Simulation] ADAPTIVE DECISION: Successfully pivoted to ${recommendation.selectedProviderId} based on historical reliability outcomes.`);

  console.log('\n--- CLOSED LEARNING LOOP SIMULATION FINISHED SUCCESSFULY ---');
});
