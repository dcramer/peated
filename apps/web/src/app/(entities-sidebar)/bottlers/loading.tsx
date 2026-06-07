import TableSkeleton from "@peated/web/components/tableSkeleton";

export default function Loading() {
  return (
    <TableSkeleton
      columnClassNames={["min-w-full sm:w-3/5", "sm:w-[10%]", "sm:w-[30%]"]}
      withSearch
    />
  );
}
