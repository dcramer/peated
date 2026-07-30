"use client";
import { use } from "react";

import UserFlavorDistributionChart from "@peated/web/components/userFlavorDistributionChart";
import UserLocationChart from "@peated/web/components/userLocationChart";
import { useProfileUserId } from "../profileContext";
import { UserBadgeList } from "../userBadgeList";
import LibraryInsights from "./library/libraryInsights";

export const fetchCache = "default-no-store";

export default function UserProfilePage(props: {
  params: Promise<{ username: string }>;
}) {
  const params = use(props.params);

  const { username } = params;
  const userId = useProfileUserId();

  return (
    <div className="space-y-8 px-3 py-2 lg:px-0">
      <section>
        <UserBadgeList userId={userId} />
      </section>

      <section aria-labelledby="tasting-profile-heading">
        <div className="mb-4">
          <h2
            id="tasting-profile-heading"
            className="text-lg font-semibold text-white"
          >
            Tasting profile
          </h2>
          <p className="text-muted mt-1 text-sm">
            The regions and flavors that show up most often in {username}
            &apos;s tastings.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <UserLocationChart userId={userId} />
          <UserFlavorDistributionChart userId={userId} />
        </div>
      </section>

      <section aria-labelledby="library-profile-heading">
        <div className="mb-4">
          <h2
            id="library-profile-heading"
            className="text-lg font-semibold text-white"
          >
            Library profile
          </h2>
          <p className="text-muted mt-1 text-sm">
            A snapshot of the bottles {username} has collected.
          </p>
        </div>
        <LibraryInsights username={username} />
      </section>
    </div>
  );
}
