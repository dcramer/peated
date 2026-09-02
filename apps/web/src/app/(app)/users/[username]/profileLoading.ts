const loadingRowCounts = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function getProfileLoadingRows(total: number) {
  const index = Math.min(Math.max(total, 1), loadingRowCounts.length) - 1;
  return loadingRowCounts[index] ?? 1;
}
