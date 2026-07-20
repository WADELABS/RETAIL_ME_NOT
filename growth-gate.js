module.exports = function(knex) {
  const GROWTH_DECISIONS = {
    HOLD: 'HOLD',
    EXPAND_MODESTLY: 'EXPAND_MODESTLY',
    FREEZE_AND_REPAIR: 'FREEZE_AND_REPAIR'
  };

  /**
   * Checks the growth metrics and returns a growth decision.
   * @returns {Promise<string>} The growth decision.
   */
  async function checkGrowthGate() {
    const metrics = await knex('growth_metrics').select('*');

    // Simplified logic: if any metric is not 'pass', hold growth.
    const allMetricsPass = metrics.every(metric => metric.status === 'pass');

    if (allMetricsPass) {
      return GROWTH_DECISIONS.EXPAND_MODESTLY;
    }

    // In a real implementation, we would have logic to decide between HOLD and FREEZE_AND_REPAIR.
    return GROWTH_DECISIONS.HOLD;
  }

  return {
    checkGrowthGate,
    GROWTH_DECISIONS
  };
};
