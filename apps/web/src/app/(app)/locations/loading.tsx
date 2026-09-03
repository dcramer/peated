import { LoadingList } from "@peated/web/components";
import { PageHeader } from "@peated/web/components/pages/pageLayout.stylex";

export default function Loading() {
  return (
    <>
      <PageHeader title="Locations" />
      <LoadingList label="Loading locations" rows={4} />
    </>
  );
}
