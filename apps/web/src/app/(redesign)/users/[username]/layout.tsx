import { getCurrentUser } from "@peated/web/lib/auth.server";
import { getProfilePage } from "@peated/web/lib/profilePage.server";
import type { ReactNode } from "react";
import type { ProfilePage, WithContext } from "schema-dts";

import { ProfileLayoutClient } from "./profileLayoutClient.stylex";

export const fetchCache = "default-no-store";

export async function generateMetadata(props: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await props.params;
  const user = await getProfilePage(username);
  return {
    title: `@${user.username}`,
    openGraph: { type: "profile", profile: { username: user.username } },
  };
}

export default async function ProfileLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [user, currentUser] = await Promise.all([
    getProfilePage(username),
    getCurrentUser(),
  ]);
  const privateRecord =
    user.private &&
    (!currentUser ||
      (user.id !== currentUser.id && user.friendStatus !== "friends"));
  const jsonLd: WithContext<ProfilePage> = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      identifier: String(user.id),
      image: user.pictureUrl ?? undefined,
      name: user.username,
    },
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
      <ProfileLayoutClient
        currentUserAdmin={Boolean(currentUser?.admin)}
        currentUserId={currentUser?.id}
        initialUser={user}
        privateRecord={privateRecord}
      >
        {children}
      </ProfileLayoutClient>
    </>
  );
}
