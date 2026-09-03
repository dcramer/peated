import { LoadingList } from "@peated/web/components";
import { PageHeader } from "@peated/web/components/pages/pageLayout.stylex";

export default function Loading() {
  return (
    <>
      <PageHeader title="Search" />
      <LoadingList label="Loading search results" rows={4} />
    </>
  );
}
