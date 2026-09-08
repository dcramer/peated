import { AdminListPageLoading } from "@peated/web/components/admin/adminContent.stylex";

export default function Loading() {
  return (
    <AdminListPageLoading
      columns={1}
      label="Loading locations"
      title="Locations"
      withSearch
    />
  );
}
