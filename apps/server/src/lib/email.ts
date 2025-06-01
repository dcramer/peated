import { createHash } from "node:crypto";
import cuid2 from "@paralleldrive/cuid2";
import { Template as MagicLinkEmailTemplate } from "@peated/email/templates/magicLinkEmail";
import { Template as NewCommentTemplate } from "@peated/email/templates/newCommentEmail";
import { Template as PasswordResetEmailTemplate } from "@peated/email/templates/passwordResetEmail";
import { Template as VerifyEmailTemplate } from "@peated/email/templates/verifyEmail";
import config from "@peated/server/config";
import { and, eq, inArray, ne } from "drizzle-orm";
import { render } from "jsx-email";
import type { Transporter } from "nodemailer";
import { createTransport } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { z } from "zod";
import { db } from "../db";
import {
  type Bottle,
  type Comment,
  type Tasting,
  type User,
  comments,
  users,
} from "../db/schema";
import type { EmailVerifySchema, PasswordResetSchema } from "../schemas";
import { generateMagicLink, signPayload } from "./auth";
import { logError } from "./log";

let mailTransport: Transporter<SMTPTransport.SentMessageInfo>;

type CommentWithRelations = Comment & {
  createdBy: User;
  tasting: Tasting & {
    bottle: Bottle;
    createdBy: User;
  };
};

const hasEmailSupport = () => {
  if (!config.URL_PREFIX) {
    logError("URL_PREFIX is not configured");
    return false;
  }

  if (!config.SMTP_FROM) {
    logError("SMTP_FROM is not configured");
    return false;
  }

  return true;
};

const createMailTransport = () => {
  const user = config.SMTP_USER;
  const auth = user
    ? {
        user,
        pass: config.SMTP_PASS,
      }
    : undefined;

  return createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: true,
    auth,
  } satisfies SMTPTransport.Options);
};

// TODO: this should be an abstraction of the notification system
export async function notifyComment({
  comment,
  transport = mailTransport,
}: {
  comment: CommentWithRelations;
  transport?: Transporter<SMTPTransport.SentMessageInfo>;
}) {
  if (!hasEmailSupport()) return;

  // dont notify self
  if (comment.createdById === comment.tasting.createdById) return;

  const userIds =
    comment.createdById === comment.tasting.createdById
      ? []
      : [comment.tasting.createdById];
  userIds.push(
    ...(
      await db
        .selectDistinct({ id: comments.createdById })
        .from(comments)
        .where(
          and(
            eq(comments.tastingId, comment.tasting.id),
            ne(comments.createdById, comment.tasting.createdById),
            ne(comments.createdById, comment.createdById)
          )
        )
    ).map((r) => r.id)
  );

  const emailList = (
    await db
      .select({ email: users.email })
      .from(users)
      .where(
        and(
          inArray(users.id, Array.from(new Set(userIds))),
          eq(users.notifyComments, true),
          eq(users.verified, true)
        )
      )
  ).map((r) => r.email);

  if (!transport) {
    if (!mailTransport) mailTransport = createMailTransport();
    transport = mailTransport;
  }

  const commentUrl = `${config.URL_PREFIX}/tastings/${comment.tasting.id}#c_${comment.id}`;

  const html = await render(
    NewCommentTemplate({ baseUrl: config.URL_PREFIX, comment })
  );

  console.log(
    `Sending email notification for comment ${comment.id} to ${comment.tasting.createdBy.email}`
  );

  for (const email of emailList) {
    try {
      await transport.sendMail({
        ...getMailDefaults(),
        to: email,
        subject: "New Comment on Tasting",
        text: `View this comment on Peated: ${commentUrl}\n\n${comment.comment}`,
        html,
      });
    } catch (err) {
      logError(err);
    }
  }
}

export async function sendVerificationEmail({
  user,
  transport = mailTransport,
}: {
  user: User;
  transport?: Transporter<SMTPTransport.SentMessageInfo>;
}) {
  // TODO: error out
  if (!hasEmailSupport()) return;

  if (!transport) {
    if (!mailTransport) mailTransport = createMailTransport();
    transport = mailTransport;
  }

  const token = await signPayload({
    email: user.email,
    id: user.id,
  } satisfies z.infer<typeof EmailVerifySchema>);

  const verifyUrl = `${config.URL_PREFIX}/verify?token=${token}`;

  const html = await render(
    VerifyEmailTemplate({ baseUrl: config.URL_PREFIX, verifyUrl })
  );

  try {
    await transport.sendMail({
      ...getMailDefaults(),
      to: user.email,
      subject: "Account Verification",
      // TODO:
      text: `Your account requires verification: ${verifyUrl}`,
      html,
    });
  } catch (err) {
    logError(err);
  }
}

export async function sendPasswordResetEmail({
  user,
  transport = mailTransport,
}: {
  user: User;
  transport?: Transporter<SMTPTransport.SentMessageInfo>;
}) {
  // TODO: error out
  if (!hasEmailSupport()) return;

  if (!transport) {
    if (!mailTransport) mailTransport = createMailTransport();
    transport = mailTransport;
  }
  const digest = createHash("md5")
    .update(user.passwordHash || "")
    .digest("hex");

  const token = await signPayload({
    email: user.email,
    id: user.id,
    createdAt: new Date().toISOString(),
    digest,
  } satisfies z.infer<typeof PasswordResetSchema>);

  const resetUrl = `${config.URL_PREFIX}/password-reset?token=${token}`;

  const html = await render(
    PasswordResetEmailTemplate({ baseUrl: config.URL_PREFIX, resetUrl })
  );

  await transport.sendMail({
    ...getMailDefaults(),
    to: user.email,
    subject: "Reset Password",
    // TODO:
    text: `A password reset was requested for your account.\n\nIf you don't recognize this request, you can ignore this.\n\nTo continue: ${resetUrl}`,
    html,
    headers: {
      References: `${cuid2.createId()}@peated.com`,
    },
  });
}

export async function sendMagicLinkEmail({
  user,
  transport = mailTransport,
}: {
  user: User;
  transport?: Transporter<SMTPTransport.SentMessageInfo>;
}) {
  // TODO: error out
  if (!hasEmailSupport()) return;

  if (!transport) {
    if (!mailTransport) mailTransport = createMailTransport();
    transport = mailTransport;
  }

  const magicLink = await generateMagicLink(user);

  const html = await render(
    MagicLinkEmailTemplate({
      baseUrl: config.URL_PREFIX,
      magicLinkUrl: magicLink.url,
    })
  );

  await transport.sendMail({
    ...getMailDefaults(),
    to: user.email,
    subject: "Magic Link for Peated",
    text: `Click the following link to log in to Peated: ${magicLink.url}`,
    html: html,
  });
}

function getMailDefaults() {
  return {
    from: `"${config.SMTP_FROM_NAME}" <${config.SMTP_FROM}>`,
    replyTo: `"${config.SMTP_FROM_NAME}" <${config.SMTP_REPLY_TO || config.SMTP_FROM}>`,
  };
}
