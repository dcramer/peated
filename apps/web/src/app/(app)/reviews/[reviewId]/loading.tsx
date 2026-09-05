import { PageColumns } from "@peated/web/components/pages/pageLayout.stylex";
import { TastingReviewDetailLoading } from "@peated/web/components/pages/tastingReviewDetail.stylex";
import { TastingReviewRailLoading } from "@peated/web/components/pages/tastingReviewRail.stylex";

export default function Loading() {
  return (
    <PageColumns rail={<TastingReviewRailLoading />} railBehavior="stack">
      <TastingReviewDetailLoading label="Loading review details" />
    </PageColumns>
  );
}
