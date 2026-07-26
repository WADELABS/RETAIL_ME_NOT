import { publisher } from '../../event-gateway/publisher/index';
import { v4 as uuidv4 } from 'uuid';

export interface FraudMetrics {
  cvvStatus: 'PASS' | 'FAIL' | 'NOT_CHECKED';
  avsStatus: 'MATCH' | 'ZIP_MISMATCH' | 'STREET_MISMATCH' | 'FULL_MISMATCH';
  hourlyOrderCount: number;
  isNewDevice: boolean;
  isProxyOrVpn: boolean;
  hasBehavioralAnomalies: boolean;
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

export class RiskService {
  // In-memory data stores for local simulation & testing
  private assessments: Map<string, RiskAssessmentRecord> = new Map();

  /**
   * Evaluates order risk, calculates a composite score (0-100), and outputs a recommendation.
   * Directly implements ECOS's multi-factor fraud prevention ruleset.
   */
  public async evaluateOrderRisk(
    orderId: string,
    customerId: string,
    metrics: FraudMetrics
  ): Promise<RiskAssessmentRecord> {
    console.log(`[Risk Engine] Running real-time fraud assessment for Order: ${orderId}...`);

    let score = 0;
    const triggeredRules: string[] = [];

    // Rule 1: CVV Status
    if (metrics.cvvStatus === 'FAIL') {
      score += 35;
      triggeredRules.push('CVV_VERIFICATION_FAILURE');
    }

    // Rule 2: AVS Status
    if (metrics.avsStatus === 'FULL_MISMATCH') {
      score += 20;
      triggeredRules.push('AVS_FULL_MISMATCH');
    } else if (metrics.avsStatus === 'ZIP_MISMATCH' || metrics.avsStatus === 'STREET_MISMATCH') {
      score += 10;
      triggeredRules.push('AVS_PARTIAL_MISMATCH');
    }

    // Rule 3: Card Testing Bot Velocity (Order Velocity Checks)
    if (metrics.hourlyOrderCount > 5) {
      score += 40;
      triggeredRules.push('CRITICAL_VELOCITY_LIMIT_EXCEEDED');
    } else if (metrics.hourlyOrderCount > 2) {
      score += 20;
      triggeredRules.push('ELEVATED_VELOCITY_DETECTED');
    }

    // Rule 4: Network Risk (Proxy/VPN)
    if (metrics.isProxyOrVpn) {
      score += 15;
      triggeredRules.push('VPN_OR_PROXY_USAGE');
    }

    // Rule 5: Behavioral Anomalies (Pasting, Bot Speeds)
    if (metrics.hasBehavioralAnomalies) {
      score += 15;
      triggeredRules.push('BEHAVIORAL_TELEMETRY_ANOMALY');
    }

    // Rule 6: Device Footprint Risk
    if (metrics.isNewDevice) {
      score += 10;
      triggeredRules.push('NEW_DEVICE_FP_RECOGNIZED');
    }

    // Cap the maximum risk score at 100
    const finalScore = Math.min(100, score);

    // Map the score to an actionable operational recommendation
    let recommendation: 'ALLOW' | 'MANUAL_REVIEW' | 'DECLINE' = 'ALLOW';
    if (finalScore >= 75) {
      recommendation = 'DECLINE'; // Hard block / Reject
    } else if (finalScore >= 50) {
      recommendation = 'MANUAL_REVIEW'; // Queue for admin review
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
    
    console.log(`[Risk Engine] Assessment complete. Score: ${finalScore}/100. Recommendation: ${recommendation}`);
    console.log(`  - Matched Rules: [${triggeredRules.join(', ')}]`);

    // Publish the risk.assessment.completed event to the gateway
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

  public getAssessment(orderId: string): RiskAssessmentRecord | undefined {
    return this.assessments.get(orderId);
  }
}
