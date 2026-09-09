import {
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminContentTable } from "@peated/web/components/admin/adminContentTable.stylex";

export default function TastingsPage() {
  return (
    <AdminPage>
      <AdminPageHeader
        description="Read tasting notes and remove content that should not appear on Peated."
        title="Tastings"
      />
      <AdminContentTable kind="tasting" />
    </AdminPage>
  );
}
