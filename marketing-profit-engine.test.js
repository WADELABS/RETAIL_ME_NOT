const { calculateAllowableCAC } = require('./marketing-profit-engine');

describe('Marketing Profit Engine', () => {
  describe('calculateAllowableCAC', () => {
    it('should calculate the allowable CAC correctly', () => {
      const inputs = {
        merchandiseContribution: 100,
        discountedFutureContribution: 50
      };
      const expected_cac = 150;
      const actual_cac = calculateAllowableCAC(inputs);
      expect(actual_cac).toBe(expected_cac);
    });

    it('should handle zero values', () => {
        const inputs = {
            merchandiseContribution: 0,
            discountedFutureContribution: 0
        };
        const expected_cac = 0;
        const actual_cac = calculateAllowableCAC(inputs);
        expect(actual_cac).toBe(expected_cac);
    });
  });
});
