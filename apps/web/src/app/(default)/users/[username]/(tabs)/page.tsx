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

      <section aria-labelledby="tastings-heading">
        <div className="mb-3">
          <h2
            id="tastings-heading"
            className="text-lg font-semibold text-white"
          >
            Tastings
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <UserLocationChart userId={userId} />
          <UserFlavorDistributionChart userId={userId} />
        </div>
      </section>

      <section aria-labelledby="library-heading">
        <div className="mb-3">
          <h2 id="library-heading" className="text-lg font-semibold text-white">
            Library
          </h2>
        </div>
        <LibraryInsights username={username} />
      </section>
    </div>
  );
}
