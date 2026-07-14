type LibraryStatusCounts = {
  open: number;
  sealed: number;
};

export function formatLibraryTabLabel({
  open,
  sealed,
}: LibraryStatusCounts): string {
  const statusCounts = [
    open > 0 ? `${open.toLocaleString()} open` : null,
    sealed > 0 ? `${sealed.toLocaleString()} sealed` : null,
  ].filter((count): count is string => count !== null);

  return statusCounts.length
    ? `Library (${statusCounts.join("/")})`
    : "Library";
}
