import type { ReactNode } from "react";
import { ErrorPageForbidden } from "../components/errorPage";
import useAuth from "../hooks/useAuth";
import DefaultLayout from "./defaultLayout";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user } = useAuth();

  if (!user) {
    // This should be handled by route-level auth checks
    return null;
  }

  if (!user.admin) {
    return <ErrorPageForbidden />;
  }

  return <DefaultLayout>{children}</DefaultLayout>;
}
