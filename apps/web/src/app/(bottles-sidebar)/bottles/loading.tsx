import TableSkeleton from "@peated/web/components/tableSkeleton";

export default function Loading() {
  return (
    <TableSkeleton
      columnClassNames={[
        "min-w-full sm:w-1/2",
        "sm:w-1/6",
        "sm:w-1/6",
        "sm:w-1/6",
      ]}
      firstColumnLines={2}
    />
  );
}
