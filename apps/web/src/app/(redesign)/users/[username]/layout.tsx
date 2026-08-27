import { getCurrentUser } from "@peated/web/lib/auth.server";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import type { ReactNode } from "react";
import type { ProfilePage, WithContext } from "schema-dts";

import { ProfileLayoutClient } from "./profileLayoutClient.stylex";

export const fetchCache = "default-no-store";

export async function generateMetadata(props: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await props.params;
  const { client } = await createServerClient();
  const user = await resolveOrNotFound(
    client.users.details({ user: username }),
  );
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
  const { client } = await createServerClient();
  const [user, currentUser] = await Promise.all([
    resolveOrNotFound(client.users.details({ user: username })),
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
