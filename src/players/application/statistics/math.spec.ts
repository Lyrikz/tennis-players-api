import { mean, median, round } from './math';

describe('math', () => {
  describe('mean', () => {
    it('returns null for an empty list', () => {
      expect(mean([])).toBeNull();
    });

    it('returns the arithmetic mean', () => {
      expect(mean([1, 2, 3, 4])).toBe(2.5);
    });
  });

  describe('median', () => {
    it('returns null for an empty list', () => {
      expect(median([])).toBeNull();
    });

    it('returns the single value of a one-element list', () => {
      expect(median([42])).toBe(42);
    });

    it('returns the middle value for an odd count', () => {
      expect(median([188, 175, 185])).toBe(185);
    });

    it('returns the mean of the two middle values for an even count', () => {
      expect(median([188, 175, 183, 185])).toBe(184);
    });

    it('sorts numerically, not lexicographically', () => {
      expect(median([100, 20, 3])).toBe(20);
    });

    it('does not mutate its input', () => {
      const values = [3, 1, 2];
      median(values);
      expect(values).toEqual([3, 1, 2]);
    });
  });

  describe('round', () => {
    it.each([
      [23.3649, 2, 23.36],
      [23.365, 2, 23.37],
      [1.005, 2, 1.01],
      [-1.005, 2, -1.01],
      [0.123456, 4, 0.1235],
      [7, 2, 7],
    ])('round(%p, %p) = %p', (value, decimals, expected) => {
      expect(round(value, decimals)).toBe(expected);
    });

    it('rounds to 2 decimals by default', () => {
      expect(round(Math.PI)).toBe(3.14);
    });
  });
});
