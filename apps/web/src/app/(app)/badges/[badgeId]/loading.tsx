import { LoadingPlaceholder } from "@peated/web/components";
import {
  PageHeader,
  PageSection,
} from "@peated/web/components/pages/pageLayout.stylex";

import { BadgeImageLoading, BadgeLeaderboardLoading } from "./badgePage.stylex";

export default function BadgeLoading() {
  return (
    <div>
      <PageHeader
        description={<LoadingPlaceholder preset="metadata" />}
        identity={<BadgeImageLoading />}
        title={<LoadingPlaceholder preset="heading" />}
      />
      <PageSection heading="Leaderboard">
        <BadgeLeaderboardLoading />
      </PageSection>
    </div>
  );
}
