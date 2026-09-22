import { Preview } from "jsx-email";
import React from "react";
import {
  defaulted,
  nullable,
  number,
  object,
  string,
  type Infer,
} from "superstruct";
import { Button, Heading, Hr, Link, Section, Text } from "../components/core";
import Layout from "../components/layout";
import ReasonFooter, { Reason } from "../components/reasonFooter";
import theme from "../theme";

export const TemplateName = "NewReportEmail";

export const TemplateStruct = object({
  report: defaulted(
    object({
      id: number(),
      /** What was reported, such as "Tasting by @jane.doe". */
      subject: string(),
      reasonLabel: string(),
      comment: nullable(string()),
      reporterUsername: string(),
      contentPreview: nullable(string()),
      contentUrl: nullable(string()),
      inboxUrl: string(),
    }),
    {
      id: 1,
      subject: "Tasting by @jane.doe",
      reasonLabel: "Spam or advertising",
      comment: "This is an ad for a bottle shop.",
      reporterUsername: "islay.fan",
      contentPreview: "Buy this bottle at my shop, link in bio.",
      contentUrl: "https://peated.com/tastings/2",
      inboxUrl: "https://peated.com/admin/moderation/inbox/report/1",
    },
  ),
  baseUrl: defaulted(string(), "https://peated.com"),
});
export type TemplateProps = Infer<typeof TemplateStruct>;

export const Template = ({ report, baseUrl }: TemplateProps) => {
  const reporterUrl = `${baseUrl}/users/${encodeURIComponent(report.reporterUsername)}`;

  return (
    <Layout baseUrl={baseUrl}>
      <Preview>{`New report: ${report.subject}`}</Preview>

      <Section>
        <Heading>{report.subject}</Heading>
        <Text>
          <Link href={reporterUrl} style={{ color: "inherit" }}>
            @{report.reporterUsername}
          </Link>{" "}
          reported this for <strong>{report.reasonLabel}</strong>.
        </Text>
        {report.comment ? <Text>“{report.comment}”</Text> : null}
      </Section>

      {report.contentPreview ? (
        <Section>
          <Text style={{ color: theme.colors.muted }}>
            {report.contentPreview}
          </Text>
        </Section>
      ) : null}

      <Section>
        <Button href={report.inboxUrl}>Review in Moderation</Button>
      </Section>

      {report.contentUrl ? (
        <Section>
          <Text>
            <Link href={report.contentUrl}>View the reported content</Link>
          </Text>
        </Section>
      ) : null}

      <Section>
        <Hr />
      </Section>

      <ReasonFooter reason={Reason.moderation} baseUrl={baseUrl} />
    </Layout>
  );
};
