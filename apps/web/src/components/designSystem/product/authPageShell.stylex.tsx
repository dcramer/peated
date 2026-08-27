"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useORPC } from "../../../lib/orpc/context";
import { AuthIntro, AuthLink, AuthShell } from "../patterns/authShell.stylex";

function DatabaseIntro() {
  const orpc = useORPC();
  const stats = useQuery(orpc.stats.queryOptions());

  return (
    <AuthIntro
      artwork={{
        alt: "",
        src: "/assets/auth-discovery-illustration.webp",
      }}
      description="Sign in to record what you pour, keep your library, and see critic and community views side by side."
      facts={[
        {
          label: "Bottles",
          value: stats.data?.totalBottles.toLocaleString("en-US") ?? "–",
        },
        {
          label: "Brands, distillers & bottlers",
          value: stats.data?.totalEntities.toLocaleString("en-US") ?? "–",
        },
      ]}
      footer={<AuthLink href="/bottles">Browse without an account →</AuthLink>}
      title="Every bottle, every review, in one place."
    />
  );
}

function AccountIntro() {
  return (
    <AuthIntro
      footer="Your tastings stay yours — export them at any time."
      points={[
        "Log a dram in three taps, then add a note when you want one.",
        "Keep the bottles you own, have open, or are hunting.",
        "Record a missing bottling and publish it to the shared database.",
      ]}
      title="An account is a shelf and a record."
    />
  );
}

export function ProductAuthShell({
  children,
  intro,
}: {
  children: ReactNode;
  intro: "account" | "database";
}) {
  return (
    <AuthShell
      intro={intro === "database" ? <DatabaseIntro /> : <AccountIntro />}
    >
      {children}
    </AuthShell>
  );
}
