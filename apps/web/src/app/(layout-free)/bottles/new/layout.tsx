import { type Metadata } from "next";

export { default } from "@peated/web/components/defaultLayout";

// Create Bottle is a focused form workflow, matching other layout-free bottle
// edit/add-release routes instead of the browse list sidebar.
export const metadata: Metadata = {
  title: "Create Bottle",
  alternates: { canonical: "https://peated.com/bottles/new" },
};
