import { BrandVoicePage } from "@peated/web/components/designSystem/product/brandVoicePage.stylex";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Brand voice",
  description:
    "The writing principles behind Peated: serious about the record and light about the drinking.",
};

export default function Page() {
  return <BrandVoicePage />;
}
