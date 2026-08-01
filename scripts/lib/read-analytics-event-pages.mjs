export const SUPABASE_REST_PAGE_SIZE = 1000;

export async function readAnalyticsEventPages({
  limit,
  pageSize = SUPABASE_REST_PAGE_SIZE,
  fetchPage,
}) {
  const rows = [];

  for (let offset = 0; offset < limit; offset += pageSize) {
    const to = Math.min(offset + pageSize - 1, limit - 1);
    const { data, error } = await fetchPage({ from: offset, to });

    if (error) {
      return { data: null, error };
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < to - offset + 1) {
      break;
    }
  }

  return { data: rows, error: null };
}
