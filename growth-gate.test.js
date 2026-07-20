const createGrowthGate = require('./growth-gate');

describe('Growth Gate', () => {
  it('should return EXPAND_MODESTLY when all metrics pass', async () => {
    const mockMetrics = [
      { metric_name: 'trailing_contribution', status: 'pass' },
      { metric_name: 'after_marketing_margin', status: 'pass' },
    ];
    
    const mockKnex = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockMetrics)
    });

    const { checkGrowthGate, GROWTH_DECISIONS } = createGrowthGate(mockKnex);
    const decision = await checkGrowthGate();

    expect(mockKnex).toHaveBeenCalledWith('growth_metrics');
    expect(decision).toBe(GROWTH_DECISIONS.EXPAND_MODESTLY);
  });

  it('should return HOLD when at least one metric is not pass', async () => {
    const mockMetrics = [
      { metric_name: 'trailing_contribution', status: 'pass' },
      { metric_name: 'after_marketing_margin', status: 'hold' },
    ];

    const mockKnex = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockMetrics)
    });

    const { checkGrowthGate, GROWTH_DECISIONS } = createGrowthGate(mockKnex);
    const decision = await checkGrowthGate();

    expect(mockKnex).toHaveBeenCalledWith('growth_metrics');
    expect(decision).toBe(GROWTH_DECISIONS.HOLD);
  });
});
