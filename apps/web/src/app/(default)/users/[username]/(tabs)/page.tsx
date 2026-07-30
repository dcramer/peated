"use client";
import { use } from "react";

import UserTastingInsights from "@peated/web/components/userTastingInsights";
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

      <UserTastingInsights userId={userId} />

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
