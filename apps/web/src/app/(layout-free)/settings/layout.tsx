"use client";

import { XMarkIcon } from "@heroicons/react/20/solid";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import useAuth from "@peated/web/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <Layout
      header={
        <Header>
          <div className="flex min-w-full items-center justify-between">
            <h1 className="text-2xl font-bold">Settings</h1>
            <Link
              href={user?.username ? `/users/${user.username}` : "/"}
              className="text-slate-400 hover:text-white"
            >
              <XMarkIcon className="h-8 w-8" />
            </Link>
          </div>
        </Header>
      }
    >
      <Tabs border>
        <TabItem as={Link} href="/settings/profile" controlled>
          Profile
        </TabItem>
        <TabItem as={Link} href="/settings/security" controlled>
          Security
        </TabItem>
      </Tabs>
      {children}
    </Layout>
  );
}
