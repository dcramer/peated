type LibraryCounts = {
  total: number;
};

export function formatLibraryTabLabel({ total }: LibraryCounts): string {
  return `Library (${total.toLocaleString()})`;
}
