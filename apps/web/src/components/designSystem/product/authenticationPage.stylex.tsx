"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useORPC } from "../../../lib/orpc/context";
import {
  AuthenticationIntro,
  AuthenticationLayout,
  AuthenticationLink,
} from "../patterns/authentication.stylex";

function DatabaseIntro() {
  const orpc = useORPC();
  const stats = useQuery(orpc.stats.queryOptions());

  return (
    <AuthenticationIntro
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
          label: "Distillers",
          value: stats.data?.totalDistilleries.toLocaleString("en-US") ?? "–",
        },
        {
          label: "Brands",
          value: stats.data?.totalBrands.toLocaleString("en-US") ?? "–",
        },
        {
          label: "Bottlers",
          value: stats.data?.totalBottlers.toLocaleString("en-US") ?? "–",
        },
        {
          label: "Blenders",
          value: stats.data?.totalBlenders.toLocaleString("en-US") ?? "–",
        },
      ]}
      footer={
        <AuthenticationLink href="/bottles">
          Browse without an account →
        </AuthenticationLink>
      }
      title="Every bottle, every review, in one place."
    />
  );
}

function AccountIntro() {
  return (
    <AuthenticationIntro
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

export function AuthenticationPage({
  children,
  intro,
}: {
  children: ReactNode;
  intro: "account" | "database";
}) {
  return (
    <AuthenticationLayout
      intro={intro === "database" ? <DatabaseIntro /> : <AccountIntro />}
    >
      {children}
    </AuthenticationLayout>
  );
}
