import { noIndexPageMetadata } from "@peated/web/lib/seoMetadata";
import type { Metadata } from "next";

export { default } from "@peated/web/components/defaultLayout";

export const metadata: Metadata = {
  title: "Finish tasting",
  ...noIndexPageMetadata,
};
