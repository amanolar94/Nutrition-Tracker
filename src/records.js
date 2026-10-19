// PostgREST commonly caps responses at 1000 rows, even with a higher limit.
// Page explicitly so history and energy totals never silently lose older records.
export async function readRows(query, max = Infinity) {
  const rows = [];
  while (rows.length < max) {
    const size = Math.min(500, max - rows.length);
    const result = await query.range(rows.length, rows.length + size - 1);
    if (result.error) return result;
    rows.push(...result.data);
    if (result.data.length < size) break;
  }
  return { data: rows, error: null };
}
