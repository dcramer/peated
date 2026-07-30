import { type Metadata } from "next";

export { default } from "@peated/web/components/defaultLayout";

// Manual Bottle entry is a focused form workflow, matching other layout-free Bottle
// edit/add-release routes instead of the browse list sidebar.
export const metadata: Metadata = {
  title: "Add Bottle",
  alternates: { canonical: "https://peated.com/bottles/new" },
};
