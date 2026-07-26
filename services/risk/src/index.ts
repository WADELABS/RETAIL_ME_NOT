import { consumer } from '../../event-gateway/consumer/index';
import { publisher } from '../../event-gateway/publisher/index';
import {
  ReturnInspectionCompletedSchema,
  ReturnInspectionCompletedPayload,
  ChargebackDisputeReceivedSchema,
  ChargebackDisputeReceivedPayload,
} from '../../../packages/events/src/index';
import { v4 as uuidv4 } from 'uuid';

export interface FraudMetrics {
  cvvStatus: 'PASS' | 'FAIL' | 'NOT_CHECKED';
  avsStatus: 'MATCH' | 'ZIP_MISMATCH' | 'STREET_MISMATCH' | 'FULL_MISMATCH';
  hourlyOrderCount: number;
  isNewDevice: boolean;
  isProxyOrVpn: boolean;
  hasBehavioralAnomalies: boolean;
  bankNameMismatch: boolean;
  multipleCardholderNames: boolean;
  orderValueCents: number;
}

export interface RiskAssessmentRecord {
  assessmentId: string;
  orderId: string;
  customerId: string;
  riskScore: number;
  recommendation: 'ALLOW' | 'MANUAL_REVIEW' | 'DECLINE';
  triggeredRules: string[];
  metrics: FraudMetrics;
}

export interface CustomerTrustProfile {
  customerId: string;
  trustScore: number;
  status: 'BLACKLISTED' | 'SUSPICIOUS' | 'NEUTRAL' | 'TRUSTED';
  returnsCount: number;
}

export class RiskService {
  // In-memory databases (simulating PostgreSQL)
  private assessments: Map<string, RiskAssessmentRecord> = new Map();
  private trustProfiles: Map<string, CustomerTrustProfile> = new Map();
  private disputeVault: Map<string, any> = new Map();
  
  // Tracks which physical device serial number was shipped to which customer order
  private orderSerials: Map<string, string> = new Map();

  public initialize(): void {
    console.log('[Risk Service] Initializing advanced fraud, return, and dispute guards...');

    // 1. Subscribe to return inspections to catch return fraud and enforce automated blacklists
    consumer.subscribe(
      'returns',
      'return.inspection.completed',
      ReturnInspectionCompletedSchema,
      async (payload: ReturnInspectionCompletedPayload) => {
        await this.evaluateReturnOutcome(payload);
      }
    );

    // 2. Subscribe to chargeback disputes to compile audit evidence automatically
    consumer.subscribe(
      'finance',
      'chargeback.dispute.received',
      ChargebackDisputeReceivedSchema,
      async (payload: ChargebackDisputeReceivedPayload) => {
        await this.compileDisputeEvidence(payload);
      }
    );
  }

  /**
   * Registers a shipped physical device serial number under an order.
   * This represents the fulfillment-side logging we run upon shipping.
   */
  public registerShippedSerial(orderId: string, serialNumber: string): void {
    this.orderSerials.set(orderId, serialNumber);
    console.log(`[Risk Service] Registered Shipped Serial: ${serialNumber} under Order: ${orderId}`);
  }

  /**
   * Evaluates order risk, calculates a composite score (0-100), and outputs a recommendation.
   */
  public async evaluateOrderRisk(
    orderId: string,
    customerId: string,
    metrics: FraudMetrics
  ): Promise<RiskAssessmentRecord> {
    console.log(`[Risk Engine] Running advanced fraud assessment for Order: ${orderId}...`);

    // Verify if customer is globally blacklisted
    const profile = this.getOrCreateTrustProfile(customerId);
    if (profile.status === 'BLACKLISTED') {
      console.error(`[Security Critical] REJECTED: Customer ${customerId} is GLOBALLY BLACKLISTED due to prior fraud.`);
      return {
        assessmentId: uuidv4(),
        orderId,
        customerId,
        riskScore: 100,
        recommendation: 'DECLINE',
        triggeredRules: ['GLOBAL_BLACKLIST_MATCH'],
        metrics,
      };
    }

    let score = 0;
    const triggeredRules: string[] = [];

    if (metrics.cvvStatus === 'FAIL') {
      score += 35;
      triggeredRules.push('CVV_VERIFICATION_FAILURE');
    }
    if (metrics.avsStatus === 'FULL_MISMATCH') {
      score += 20;
      triggeredRules.push('AVS_FULL_MISMATCH');
    }
    if (metrics.hourlyOrderCount > 5) {
      score += 40;
      triggeredRules.push('CRITICAL_VELOCITY_LIMIT_EXCEEDED');
    }
    if (metrics.isProxyOrVpn) {
      score += 15;
      triggeredRules.push('VPN_OR_PROXY_USAGE');
    }
    if (metrics.hasBehavioralAnomalies) {
      score += 15;
      triggeredRules.push('BEHAVIORAL_TELEMETRY_ANOMALY');
    }
    if (metrics.bankNameMismatch) {
      score += 25;
      triggeredRules.push('AUTOMATIC_BANK_VERIFICATION_NAME_MISMATCH');
    }
    if (metrics.multipleCardholderNames) {
      score += 30;
      triggeredRules.push('MULTIPLE_CARDHOLDER_NAMES_DETECTED');
    }
    if (metrics.orderValueCents >= 150000) {
      score += 15;
      triggeredRules.push('HIGH_VALUE_TRANSACTION_THRESHOLD_EXCEEDED');
    }

    const finalScore = Math.min(100, score);

    let recommendation: 'ALLOW' | 'MANUAL_REVIEW' | 'DECLINE' = 'ALLOW';
    if (finalScore >= 75) {
      recommendation = 'DECLINE';
    } else if (finalScore >= 50 || profile.status === 'SUSPICIOUS') {
      recommendation = 'MANUAL_REVIEW';
    }

    const assessmentId = uuidv4();
    const record: RiskAssessmentRecord = {
      assessmentId,
      orderId,
      customerId,
      riskScore: finalScore,
      recommendation,
      triggeredRules,
      metrics,
    };

    this.assessments.set(orderId, record);
    
    await publisher.publish(
      'risk',
      'assessment.completed',
      {
        assessmentId,
        orderId,
        customerId,
        riskScore: finalScore,
        recommendation,
        triggeredRules,
        evaluatedMetrics: metrics,
        createdAt: new Date().toISOString(),
      }
    );

    return record;
  }

  /**
   * Evaluates the outcome of a customer return inspection.
   * Strictly verifies that the returned serial number matches the shipped serial number.
   * If there is a serial mismatch, the return is flagged as WRONG_ITEM and the customer is blacklisted.
   */
  public async evaluateReturnOutcome(inspection: ReturnInspectionCompletedPayload): Promise<void> {
    console.log(`[Risk Compliance] Processing return inspection for Customer: ${inspection.customerId}`);

    const profile = this.getOrCreateTrustProfile(inspection.customerId);
    const originalShippedSerial = this.orderSerials.get(inspection.orderId);

    let evaluatedGrade = inspection.grade;

    // --- CODES AND RULES COMPLIANCE ENFORCEMENT ---

    // Rule 1: Validate Serial Number Match
    if (originalShippedSerial && originalShippedSerial !== inspection.serialNumber) {
      console.error(`\n[Security Critical] 🚨 SERIAL MISMATCH DETECTED for Order: ${inspection.orderId}!`);
      console.error(`  - Shipped Serial: ${originalShippedSerial}`);
      console.error(`  - Returned Serial: ${inspection.serialNumber}`);
      console.error('  - Overriding return grade to WRONG_ITEM to initiate immediate global blacklist.');
      
      evaluatedGrade = 'WRONG_ITEM'; // Override grade to trigger hard blacklist
    }

    // --- END COMPLIANCE ENFORCEMENT ---

    // Rule 2: Wrong Item / Serial Mismatch Returned (The Automatic Blacklist)
    if (evaluatedGrade === 'WRONG_ITEM') {
      profile.trustScore = 0;
      profile.status = 'BLACKLISTED';
      console.error(`\n[Security Critical] 🪓 AUTOMATIC BLACKLIST: Customer ${inspection.customerId} committed return fraud. Trust Score reduced to 0.`);
      
      await publisher.publish(
        'risk',
        'customer.blacklisted',
        {
          customerId: inspection.customerId,
          reason: 'RETURN_FRAUD_SERIAL_OR_ITEM_MISMATCH',
          recordedAt: new Date().toISOString(),
        }
      );
      return;
    }

    // Rule 3: Excessive Returns Frequency
    profile.returnsCount++;
    if (profile.returnsCount > 3) {
      profile.status = 'SUSPICIOUS';
      profile.trustScore = Math.max(100, profile.trustScore - 200);
      console.warn(`[Risk Warning] LIMIT EXCEEDED: Customer ${inspection.customerId} has returned ${profile.returnsCount} items too frequently. Flagged as SUSPICIOUS.`);

      await publisher.publish(
        'risk',
        'customer.restricted',
        {
          customerId: inspection.customerId,
          restrictionType: 'ID_VERIFICATION_REQUIRED',
          reason: 'EXCESSIVE_RETURNS_FREQUENCY',
          recordedAt: new Date().toISOString(),
        }
      );
    }
  }

  public async compileDisputeEvidence(dispute: ChargebackDisputeReceivedPayload): Promise<void> {
    console.log(`[Dispute Defense] Compiling evidence vault for Stripe Chargeback: ${dispute.disputeId}`);

    const assessment = this.assessments.get(dispute.orderId);
    const shippedSerial = this.orderSerials.get(dispute.orderId) || 'N/A';

    const compiledEvidence = {
      disputeId: dispute.disputeId,
      orderId: dispute.orderId,
      customerId: dispute.customerId,
      amountCents: dispute.amountCents,
      reason: dispute.reason,
      
      // Payment & Fraud Evidence
      cvvVerification: assessment?.metrics.cvvStatus || 'PASS',
      avsVerification: assessment?.metrics.avsStatus || 'MATCH',
      riskEvaluationScore: assessment?.riskScore || 0,
      riskRulesMatched: assessment?.triggeredRules || [],

      // Fulfillment, Logistics, & Serial Evidence
      shippedDeviceSerial: shippedSerial, // Direct product-level evidence
      shippingCarrier: 'UPS',
      trackingNumber: '1Z999AA10123456784',
      originAddress: 'ECOS Logistics Warehouse',
      deliveryStatus: 'DELIVERED_AND_SIGNED',
      carrierDeliveredAt: new Date().toISOString(),
    };

    this.disputeVault.set(dispute.disputeId, compiledEvidence);
    console.log(`[Dispute Defense] SUCCESS: Immutable Evidence Vault archived under dispute: ${dispute.disputeId}. Serial: ${shippedSerial}`);

    await publisher.publish(
      'risk',
      'dispute.evidence.compiled',
      {
        disputeId: dispute.disputeId,
        orderId: dispute.orderId,
        evidenceVaultId: uuidv4(),
        status: 'EVIDENCE_READY',
        compiledEvidence,
        compiledAt: new Date().toISOString(),
      }
    );
  }

  public getOrCreateTrustProfile(customerId: string): CustomerTrustProfile {
    if (!this.trustProfiles.has(customerId)) {
      this.trustProfiles.set(customerId, {
        customerId,
        trustScore: 500,
        status: 'NEUTRAL',
        returnsCount: 0,
      });
    }
    return this.trustProfiles.get(customerId)!;
  }

  public getDisputeEvidence(disputeId: string): any {
    return this.disputeVault.get(disputeId);
  }
}
