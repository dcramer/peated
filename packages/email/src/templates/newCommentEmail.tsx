import {
  Button,
  Column,
  Heading,
  Hr,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "jsx-email";
import Layout from "../components/layout";

import {
  defaulted,
  nullable,
  number,
  object,
  string,
  type Infer,
} from "superstruct";

export const TemplateName = "NewCommentEmail";

export const TemplateStruct = object({
  comment: defaulted(
    object({
      id: number(),
      comment: string(),
      tasting: object({
        id: number(),
        bottle: object({
          fullName: string(),
        }),
      }),
      createdBy: object({
        username: string(),
        pictureUrl: nullable(string()),
      }),
    }),
    {
      id: 1,
      comment:
        "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).",
      tasting: {
        id: 2,
        bottle: {
          fullName: "Macallan 12-year-old",
        },
      },
      createdBy: {
        username: "jane.doe",
        pictureUrl: null,
      },
    },
  ),
  baseUrl: defaulted(string(), "https://peated.com"),
});
export type TemplateProps = Infer<typeof TemplateStruct>;

export const Template = ({ comment, baseUrl }: TemplateProps) => {
  const tastingUrl = `${baseUrl}/tastings/${comment.tasting.id}`;
  const commentUrl = `${tastingUrl}#c_${comment.id}`;
  const settingsUrl = `${baseUrl}/settings`;
  const profileUrl = `${baseUrl}/users/${encodeURIComponent(comment.createdBy.username)}`;
  const avatarUrl =
    comment.createdBy.pictureUrl || `${baseUrl}/assets/default-avatar.png`;

  const previewText = `New Comment from ${comment.createdBy.username}`;

  return (
    <Layout baseUrl={baseUrl}>
      <Preview>{previewText}</Preview>

      <Section className="mb-[16px] px-[24px] pt-[16px]">
        <Row>
          <Column className="w-[64px] pr-[20px]">
            <Img
              className="rounded-full"
              src={avatarUrl}
              width="64px"
              height="64px"
            />
          </Column>
          <Column>
            <Heading
              className="m-0 text-[24px] font-normal text-white"
              disableDefaultStyle
            >
              <Link
                href={profileUrl}
                disableDefaultStyle
                className="font-bold text-white no-underline"
              >
                {comment.createdBy.username}
              </Link>{" "}
              commented on{" "}
              <Link
                href={tastingUrl}
                disableDefaultStyle
                className="font-bold text-white no-underline"
              >
                {comment.tasting.bottle.fullName}
              </Link>
            </Heading>
          </Column>
        </Row>
      </Section>

      <Section className="mb-[16px] px-[24px] pt-[16px]">
        <Text
          disableDefaultStyle
          className="m-0 text-[14px] leading-[24px] text-white"
        >
          {comment.comment}
        </Text>
      </Section>

      <Section className="mb-[16px] px-[24px] pt-[16px] text-center">
        <Button
          className="border-highlight bg-highlight rounded px-5 py-3 text-center text-[12px] font-semibold text-black no-underline"
          href={commentUrl}
        >
          View Comment
        </Button>
      </Section>

      <Section className="mb-[8px] px-[24px] pt-[8px] text-center">
        <Hr
          disableDefaultStyle
          className="w-full border border-solid border-slate-700"
        />
      </Section>

      <Section className="mb-[16px] px-[24px] pt-[16px] text-center">
        <Text
          disableDefaultStyle
          className="text-muted m-0 text-[12px] leading-[24px]"
        >
          You are being notified because you are subscribed to comments.{" "}
          <Link
            disableDefaultStyle
            href={settingsUrl}
            className="text-white underline"
          >
            Settings
          </Link>
        </Text>
      </Section>
    </Layout>
  );
};
