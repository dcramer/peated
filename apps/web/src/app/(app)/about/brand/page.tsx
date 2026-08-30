import type { Metadata } from "next";
import { BrandVoicePage } from "./brandVoicePage.stylex";

export const metadata: Metadata = {
  title: "Brand voice",
  description:
    "The writing principles behind Peated: serious about the record and light about the drinking.",
};

export default function Page() {
  return <BrandVoicePage />;
}
