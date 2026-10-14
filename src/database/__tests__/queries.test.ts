import { describe, it, expect } from '@jest/globals';
import { getTransactionCount } from '../queries';

describe('getTransactionCount', () => {
  it('returns count from database query result', async () => {
    const mockDb = {
      getFirstAsync: async (query: string) => {
        if (query.includes('COUNT(*)')) {
          return { count: 125 };
        }
        return null;
      },
    } as any;

    const count = await getTransactionCount(mockDb);
    expect(count).toBe(125);
  });

  it('returns 0 if getFirstAsync returns null or empty', async () => {
    const mockDb = {
      getFirstAsync: async () => null,
    } as any;

    const count = await getTransactionCount(mockDb);
    expect(count).toBe(0);
  });
});
