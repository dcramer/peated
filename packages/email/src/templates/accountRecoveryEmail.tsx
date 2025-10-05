import theme from "@peated/design";
import { Preview } from "jsx-email";
import React from "react";
import { defaulted, object, string, type Infer } from "superstruct";
import { Button, Link, Section, Text } from "../components/core";
import Layout from "../components/layout";

export const TemplateName = "AccountRecoveryEmail";

export const TemplateStruct = object({
  resetUrl: defaulted(string(), "https://peated.com/recover-account"),
  baseUrl: defaulted(string(), "https://peated.com"),
});
export type TemplateProps = Infer<typeof TemplateStruct>;

export const Template = ({ resetUrl, baseUrl }: TemplateProps) => {
  const previewText = `Account recovery was requested for your account.`;

  return (
    <Layout baseUrl={baseUrl}>
      <Preview>{previewText}</Preview>

      <Section>
        <Text>
          An account recovery was requested for your account on{" "}
          <Link
            href={baseUrl}
            disableDefaultStyle
            style={{
              color: theme.colors.highlight,
              textDecoration: "underline",
            }}
          >
            <strong>Peated</strong>
          </Link>
          .
        </Text>
      </Section>

      <Section>
        <Button href={resetUrl}>Recover Account</Button>
      </Section>

      <Section>
        <Text
          style={{
            color: theme.colors.muted,
          }}
        >
          If you don't recognize this request, you can ignore this email.
        </Text>
      </Section>
    </Layout>
  );
};
