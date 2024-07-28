import theme from "@peated/design";
import { Link } from "jsx-email";
import React from "react";
import { Section, Text } from "./core";

export enum Reason {
  comments = "You are being notified because you are subscribed to comments.",
}

export default function ReasonFooter({
  reason,
  baseUrl,
}: {
  reason: Reason;
  baseUrl: string;
}) {
  return (
    <Section>
      <Text
        disableDefaultStyle
        style={{
          margin: 0,
          padding: 0,
          fontSize: "14px",
          lineHeight: "24px",
          color: theme.colors.muted,
        }}
      >
        {reason}{" "}
        <Link
          disableDefaultStyle
          href={`${baseUrl}/settings`}
          style={{
            color: theme.colors.muted,
            textDecoration: "underline",
          }}
        >
          Settings
        </Link>
      </Text>
    </Section>
  );
}
