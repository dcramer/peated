import { getBottlePlainTextIdentity } from "@peated/web/lib/bottleLabel";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import type { ReactNode } from "react";

interface TastingOpenGraphMetadata {
  title: string;
  description: string | null;
  images?: string[];
}

interface TastingTwitterMetadata {
  card: "summary" | "summary_large_image";
  images?: string[];
}

export async function generateMetadata(props: {
  params: Promise<{ tastingId: string }>;
}) {
  const params = await props.params;

  const { tastingId } = params;

  const { client } = await getServerClient();

  const tasting = await resolveOrNotFound(
    client.tastings.details({ tasting: Number(tastingId) }),
  );
  const title = `${getBottlePlainTextIdentity(tasting.bottle)} - Tasting Notes by ${tasting.createdBy.username}`;
  const openGraph: TastingOpenGraphMetadata = {
    title,
    description: tasting.notes,
  };
  const twitter: TastingTwitterMetadata = {
    card: tasting.imageUrl ? "summary_large_image" : "summary",
  };
  if (tasting.imageUrl) {
    openGraph.images = [tasting.imageUrl];
    twitter.images = [tasting.imageUrl];
  }
  return {
    title,
    description: tasting.notes,
    openGraph,
    twitter,
  };
}

export default async function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
