import { Preview } from "jsx-email";
import React from "react";
import { defaulted, object, string, type Infer } from "superstruct";
import { Button, Link, Section, Text } from "../components/core";
import Layout from "../components/layout";
import theme from "../theme";

export const TemplateName = "AccountDeletion";

export const TemplateStruct = object({
  baseUrl: defaulted(string(), "https://peated.com"),
  deletionDate: defaulted(string(), "September 22, 2026 at 6:00 PM UTC"),
  cancelUrl: defaulted(string(), "https://peated.com/settings/security"),
});
export type TemplateProps = Infer<typeof TemplateStruct>;

export const Template = ({
  baseUrl,
  deletionDate,
  cancelUrl,
}: TemplateProps) => {
  const previewText = `Your Peated account will be deleted on ${deletionDate}.`;

  return (
    <Layout baseUrl={baseUrl}>
      <Preview>{previewText}</Preview>

      <Section>
        <Text>
          You asked us to delete your{" "}
          <Link
            href={baseUrl}
            disableDefaultStyle
            style={{
              color: theme.colors.highlight,
              textDecoration: "underline",
            }}
          >
            <strong>Peated</strong>
          </Link>{" "}
          account. It will be deleted on {deletionDate}. Until then you can
          still sign in and keep it.
        </Text>
      </Section>

      <Section>
        <Button href={cancelUrl}>Keep my account</Button>
      </Section>

      <Section>
        <Text
          style={{
            color: theme.colors.muted,
          }}
        >
          If you didn't ask for this, sign in and cancel the deletion, then
          change your password.
        </Text>
      </Section>
    </Layout>
  );
};
