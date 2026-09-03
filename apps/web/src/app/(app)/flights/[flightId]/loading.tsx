import { LoadingList, LoadingPlaceholder } from "@peated/web/components";
import { PageHeader } from "@peated/web/components/pages/pageLayout.stylex";

export default function Loading() {
  return (
    <>
      <PageHeader title={<LoadingPlaceholder preset="heading" />} />
      <LoadingList label="Loading flight bottles" rows={4} />
    </>
  );
}
