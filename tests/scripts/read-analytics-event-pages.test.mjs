import assert from "node:assert/strict";
import test from "node:test";

import {
  readAnalyticsEventPages,
  SUPABASE_REST_PAGE_SIZE,
} from "../../scripts/lib/read-analytics-event-pages.mjs";

test("reads every analytics row across Supabase REST pages", async () => {
  const source = Array.from({ length: 2501 }, (_, index) => ({ index }));
  const ranges = [];

  const result = await readAnalyticsEventPages({
    limit: 20000,
    fetchPage: async ({ from, to }) => {
      ranges.push({ from, to });
      return { data: source.slice(from, to + 1), error: null };
    },
  });

  assert.equal(SUPABASE_REST_PAGE_SIZE, 1000);
  assert.deepEqual(ranges, [
    { from: 0, to: 999 },
    { from: 1000, to: 1999 },
    { from: 2000, to: 2999 },
  ]);
  assert.equal(result.error, null);
  assert.equal(result.data?.length, source.length);
  assert.deepEqual(result.data?.at(-1), { index: 2500 });
});

test("never reads beyond the analytics query limit", async () => {
  const source = Array.from({ length: 4000 }, (_, index) => ({ index }));
  const ranges = [];

  const result = await readAnalyticsEventPages({
    limit: 2500,
    fetchPage: async ({ from, to }) => {
      ranges.push({ from, to });
      return { data: source.slice(from, to + 1), error: null };
    },
  });

  assert.deepEqual(ranges, [
    { from: 0, to: 999 },
    { from: 1000, to: 1999 },
    { from: 2000, to: 2499 },
  ]);
  assert.equal(result.data?.length, 2500);
  assert.deepEqual(result.data?.at(-1), { index: 2499 });
});

test("stops paging and returns the Supabase error", async () => {
  const ranges = [];
  const expectedError = { code: "query_failed" };

  const result = await readAnalyticsEventPages({
    limit: 5000,
    fetchPage: async ({ from, to }) => {
      ranges.push({ from, to });
      if (from === 1000) {
        return { data: null, error: expectedError };
      }
      return {
        data: Array.from({ length: to - from + 1 }, (_, index) => ({ index })),
        error: null,
      };
    },
  });

  assert.deepEqual(ranges, [
    { from: 0, to: 999 },
    { from: 1000, to: 1999 },
  ]);
  assert.equal(result.data, null);
  assert.equal(result.error, expectedError);
});
