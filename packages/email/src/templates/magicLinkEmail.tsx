import theme from "@peated/design";
import { Preview } from "jsx-email";
import React from "react";
import { defaulted, object, string, type Infer } from "superstruct";
import { Button, Section, Text } from "../components/core";
import Layout from "../components/layout";

export const TemplateName = "PasswordResetEmail";

export const TemplateStruct = object({
  magicLinkUrl: defaulted(string(), "https://peated.com/magic-link"),
  baseUrl: defaulted(string(), "https://peated.com"),
});
export type TemplateProps = Infer<typeof TemplateStruct>;

export const Template = ({ magicLinkUrl, baseUrl }: TemplateProps) => {
  const previewText = `Login to your Peated account.`;

  return (
    <Layout baseUrl={baseUrl}>
      <Preview>{previewText}</Preview>

      <Section>
        <Text>A link was requested to log in to your account on Peated.</Text>
      </Section>

      <Section>
        <Button href={magicLinkUrl}>Login</Button>
      </Section>

      <Section>
        <Text
          style={{
            color: theme.colors.muted,
          }}
        >
          If you don't recognize this action, you should ignore this email.
        </Text>
      </Section>
    </Layout>
  );
};
