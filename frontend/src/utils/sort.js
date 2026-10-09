/**
 * Newest record first. New rows get the next (highest) identity value, so
 * sorting by guid descending puts the most recently created record on top
 * (Defect 4). Rows without a numeric guid keep their relative order, after
 * the ones that have one. Returns a new array; the input is not mutated.
 */
export function newestFirst(list, key = "guid") {
  const num = (r) => {
    const n = Number(r?.[key]);
    return Number.isFinite(n) && r?.[key] !== "" && r?.[key] != null ? n : null;
  };
  return [...(list || [])]
    .map((r, i) => ({ r, i, n: num(r) }))
    .sort((a, b) => {
      if (a.n != null && b.n != null) return b.n - a.n || a.i - b.i;
      if (a.n != null) return -1;
      if (b.n != null) return 1;
      return a.i - b.i;
    })
    .map((x) => x.r);
}
