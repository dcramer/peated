import { AdminListPageLoading } from "@peated/web/components/admin/adminContent.stylex";

export default function Loading() {
  return (
    <AdminListPageLoading
      columns={3}
      label="Loading OAuth clients"
      title="OAuth clients"
    />
  );
}
