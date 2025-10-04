import theme from "@peated/design";
import { Preview } from "jsx-email";
import React from "react";
import { defaulted, number, object, string, type Infer } from "superstruct";
import { Button, Section, Text } from "../components/core";
import Layout from "../components/layout";

export const TemplateName = "PasswordResetEmail";

export const TemplateStruct = object({
  magicLinkUrl: defaulted(string(), "https://peated.com/magic-link"),
  baseUrl: defaulted(string(), "https://peated.com"),
  code: defaulted(string(), "123456"),
  expiresInMins: defaulted(number(), 10),
});
export type TemplateProps = Infer<typeof TemplateStruct>;

export const Template = ({
  magicLinkUrl,
  baseUrl,
  code,
  expiresInMins,
}: TemplateProps) => {
  const previewText = `Login to your Peated account.`;

  return (
    <Layout baseUrl={baseUrl}>
      <Preview>{previewText}</Preview>

      <Section>
        <Text>A link was requested to log in to your account on Peated.</Text>
      </Section>

      <Section>
        <Text style={{ fontSize: 20, fontWeight: 700 }}>
          Your code: {formatCode(code)}
        </Text>
        <Text style={{ color: theme.colors.muted }}>
          Expires in {expiresInMins} minutes.
        </Text>
      </Section>

      <Section>
        <Button href={magicLinkUrl}>Sign in</Button>
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

function formatCode(code: string) {
  if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`;
  if (code.length === 8) return `${code.slice(0, 4)} ${code.slice(4)}`;
  return code;
}
