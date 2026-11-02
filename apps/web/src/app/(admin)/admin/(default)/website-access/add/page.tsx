"use client";

import { AdminBreadcrumbs } from "@peated/web/components/admin/adminContent.stylex";
import RobotsExceptionForm from "@peated/web/components/admin/robotsExceptionForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const update = useMutation(orpc.admin.botSites.update.mutationOptions());

  return (
    <>
      <AdminBreadcrumbs
        items={[
          { label: "Scrapers", href: "/admin/sites" },
          { label: "Website access", href: "/admin/website-access" },
          {
            label: "Add exception",
            href: "/admin/website-access/add",
            current: true,
          },
        ]}
      />
      <RobotsExceptionForm
        onSubmit={async ({ origin, reason }) => {
          await update.mutateAsync({
            origin,
            robotsException: { reason },
          });
          await queryClient.invalidateQueries({
            queryKey: orpc.admin.botSites.list.key(),
          });
          router.push("/admin/website-access");
        }}
      />
    </>
  );
}
