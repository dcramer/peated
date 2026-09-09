import config from "@peated/web/config";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { getProfilePage } from "@peated/web/lib/profilePage.server";
import { noIndexPageMetadata } from "@peated/web/lib/seoMetadata";
import { serializeJsonLd } from "@peated/web/lib/structuredData";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { ProfilePage, WithContext } from "schema-dts";

import { ProfileLayoutClient } from "./profileLayoutClient.stylex";

export const fetchCache = "default-no-store";

export async function generateMetadata(props: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await props.params;
  const user = await getProfilePage(username);
  if (user.private) {
    return {
      title: "Private profile",
      ...noIndexPageMetadata,
    };
  }

  const path = `/users/${encodeURIComponent(user.username)}`;
  const url = new URL(path, config.URL_PREFIX).href;
  const description = `Whisky profile for @${user.username} on Peated.`;
  return {
    title: `@${user.username}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      title: `@${user.username}`,
      description,
      url,
      username: user.username,
    },
    twitter: { card: "summary", title: `@${user.username}`, description },
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
  const url = new URL(
    `/users/${encodeURIComponent(user.username)}`,
    config.URL_PREFIX,
  ).href;
  const jsonLd: WithContext<ProfilePage> | null = user.private
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "@id": url,
        url,
        mainEntity: {
          "@type": "Person",
          "@id": `${url}#person`,
          identifier: String(user.id),
          image: user.pictureUrl ?? undefined,
          name: user.username,
          url,
        },
      };

  return (
    <>
      {jsonLd ? (
        <script
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
          type="application/ld+json"
        />
      ) : null}
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
