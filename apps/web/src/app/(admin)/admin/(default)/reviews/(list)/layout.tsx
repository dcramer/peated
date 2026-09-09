"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import {
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import { PageTabs } from "@peated/web/components/pageTabs.stylex";

export default function ReviewsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AdminPage>
      <AdminPageHeader
        description="Read reviews and remove content that should not appear on Peated."
        title="Reviews"
      />
      <PageTabs
        ariaLabel="Review type"
        currentHref={pathname}
        items={[
          { href: "/admin/reviews", label: "Member reviews" },
          { href: "/admin/reviews/critics", label: "Critic reviews" },
        ]}
      />
      {children}
    </AdminPage>
  );
}
