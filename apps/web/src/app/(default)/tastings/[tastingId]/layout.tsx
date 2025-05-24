import { getServerClient } from "@peated/web/lib/orpc/client.server";
import type { ReactNode } from "react";

export async function generateMetadata({
  params: { tastingId },
}: {
  params: { tastingId: string };
}) {
  const client = await getServerClient();

  const tasting = await client.tastings.details({ tasting: Number(tastingId) });
  const title = `${tasting.bottle.fullName} - Tasting Notes by ${tasting.createdBy.username}`;
  return {
    title,
    description: tasting.notes,
    openGraph: {
      title,
      description: tasting.notes,
      ...(tasting.imageUrl
        ? {
            images: [tasting.imageUrl],
          }
        : {}),
    },
    twitter: {
      ...(tasting.imageUrl
        ? {
            card: "summary_large_image",
            images: [tasting.imageUrl],
          }
        : {
            card: "summary",
          }),
    },
  };
}

export default async function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
