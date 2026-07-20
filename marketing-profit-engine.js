/**
 * The Marketing Profit Engine calculates key metrics to ensure that
 * marketing campaigns are profitable and sustainable.
 */

// Default controls from the prompt
const LTV_HAIRCUT = 0.50; // 50%
const MINIMUM_ATTRIBUTION_CONFIDENCE = 0.70; // 70%
const MAXIMUM_DAILY_BUDGET_INCREASE = 0.10; // 10%
const MAXIMUM_WEEKLY_REVENUE_GROWTH = 0.10; // 10%
const MAXIMUM_SINGLE_CHANNEL_SHARE = 0.50; // 50%
const EXPLORATION_BUDGET = 0.10; // 10%

/**
 * Calculates the allowable Customer Acquisition Cost (CAC).
 *
 * @param {object} inputs - The inputs for the calculation.
 * @param {number} inputs.merchandiseContribution - The contribution from merchandise.
 * @param {number} inputs.discountedFutureContribution - The conservatively discounted future contribution.
 * @returns {number} The allowable CAC.
 */
function calculateAllowableCAC({ merchandiseContribution, discountedFutureContribution }) {
  // This is a simplified initial calculation.
  // The actual calculation would be more complex and involve more factors.
  const allowable_cac = merchandiseContribution + discountedFutureContribution;
  return allowable_cac;
}

module.exports = {
  calculateAllowableCAC,
  LTV_HAIRCUT,
  MINIMUM_ATTRIBUTION_CONFIDENCE,
  MAXIMUM_DAILY_BUDGET_INCREASE,
  MAXIMUM_WEEKLY_REVENUE_GROWTH,
  MAXIMUM_SINGLE_CHANNEL_SHARE,
  EXPLORATION_BUDGET
};
