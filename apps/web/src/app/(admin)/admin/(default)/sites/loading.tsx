import { AdminListPageLoading } from "@peated/web/components/admin/adminContent.stylex";

export default function Loading() {
  return (
    <AdminListPageLoading
      columns={4}
      label="Loading scrapers"
      title="Scrapers"
    />
  );
}
