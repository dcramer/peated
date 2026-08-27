import type { Metadata } from "next";

import { BottleListController } from "@peated/web/components/designSystem/product/bottleListController.stylex";

export const metadata: Metadata = {
  title: "Whisky Bottles",
  description: "Browse whisky bottles recorded in the Peated database.",
};

export default function BottleListPage() {
  return <BottleListController />;
}
