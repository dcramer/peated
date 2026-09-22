import cuid2 from "@paralleldrive/cuid2";
import { Template as AccountDeletionEmailTemplate } from "@peated/email/templates/accountDeletionEmail";
import { Template as AccountRecoveryEmailTemplate } from "@peated/email/templates/accountRecoveryEmail";
import { Template as MagicLinkEmailTemplate } from "@peated/email/templates/magicLinkEmail";
import { Template as NewCommentTemplate } from "@peated/email/templates/newCommentEmail";
import { Template as NewReportTemplate } from "@peated/email/templates/newReportEmail";
import { Template as VerifyEmailTemplate } from "@peated/email/templates/verifyEmail";
import config from "@peated/server/config";
import { createHash } from "crypto";
import { and, eq, inArray, ne } from "drizzle-orm";
import { render } from "jsx-email";
import type { Transporter } from "nodemailer";
import { createTransport } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { z } from "zod";
import { db } from "../db";
import {
  comments,
  users,
  type Comment,
  type Tasting,
  type User,
} from "../db/schema";
import type { EmailVerifySchema, PasswordResetSchema } from "../schemas";
import { generateMagicLink, signToken } from "./auth";
import { formatBottleDisplayName } from "./bottleDisplayName";
import { logError, logInfo } from "./log";
import { resolveActiveBottleIds } from "./resolveActiveBottleIds";

let mailTransport: Transporter<SMTPTransport.SentMessageInfo>;

type CommentWithRelations = Comment & {
  createdBy: User;
  tasting: Tasting & {
    createdBy: User;
  };
};

const hasEmailSupport = () => {
  const error = getEmailSupportError({ requireSmtpCredentials: false });
  if (error) logError(error);

  return !error;
};

function getEmailSupportError({
  requireSmtpCredentials,
}: {
  requireSmtpCredentials: boolean;
}) {
  if (!config.URL_PREFIX) return "URL_PREFIX is not configured";
  if (!config.SMTP_FROM) return "SMTP_FROM is not configured";
  if (
    requireSmtpCredentials &&
    config.SMTP_HOST === "smtp.sendgrid.net" &&
    (!config.SMTP_USER || !config.SMTP_PASS)
  ) {
    return "SMTP credentials are not configured";
  }
  return null;
}

function assertEmailSupport() {
  const error = getEmailSupportError({ requireSmtpCredentials: true });
  if (error) throw new Error(error);
}

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

  if (comment.tasting.bottleId === null) {
    throw new Error(`Tasting ${comment.tasting.id} has no Bottle`);
  }
  const bottle = await db.transaction(async (tx) => {
    await resolveActiveBottleIds(tx, [comment.tasting.bottleId!]);
    return tx.query.bottles.findFirst({
      where: (bottles, { eq }) => eq(bottles.id, comment.tasting.bottleId!),
      with: { brand: true, group: true, series: true },
    });
  });
  if (!bottle) {
    throw new Error(
      `Tasting ${comment.tasting.id} references missing Bottle ${comment.tasting.bottleId}`,
    );
  }
  const bottleName = formatBottleDisplayName(bottle);

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
            ne(comments.createdById, comment.createdById),
          ),
        )
    ).map((r) => r.id),
  );

  const emailList = (
    await db
      .select({ email: users.email })
      .from(users)
      .where(
        and(
          inArray(users.id, Array.from(new Set(userIds))),
          eq(users.notifyComments, true),
          eq(users.verified, true),
        ),
      )
  ).map((r) => r.email);

  if (!transport) {
    if (!mailTransport) mailTransport = createMailTransport();
    transport = mailTransport;
  }

  const commentUrl = `${config.URL_PREFIX}/tastings/${comment.tasting.id}#c_${comment.id}`;

  const html = await render(
    NewCommentTemplate({
      baseUrl: config.URL_PREFIX,
      comment: {
        id: comment.id,
        comment: comment.comment,
        createdBy: {
          username: comment.createdBy.username,
          pictureUrl: comment.createdBy.pictureUrl,
        },
        tasting: {
          id: comment.tasting.id,
          bottleName,
        },
      },
    }),
  );

  logInfo("Sending comment notification email for comment {commentId}", {
    extra: {
      commentId: comment.id,
      recipient: comment.tasting.createdBy.email,
    },
  });

  for (const email of emailList) {
    try {
      await transport.sendMail({
        ...getMailDefaults(),
        to: email,
        subject: "New Comment on Tasting",
        text: `View this comment on Peated: ${commentUrl}\n\n${bottleName}\n\n${comment.comment}`,
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

  const token = await signToken(
    {
      email: user.email,
      id: user.id,
    } satisfies z.infer<typeof EmailVerifySchema>,
    "email-verification",
  );

  const verifyUrl = `${config.URL_PREFIX}/verify?token=${token}`;

  const html = await render(
    VerifyEmailTemplate({ baseUrl: config.URL_PREFIX, verifyUrl }),
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
  const digest = createHash("sha256")
    .update(user.passwordHash || "")
    .digest("hex");

  const token = await signToken(
    {
      email: user.email,
      id: user.id,
      createdAt: new Date().toISOString(),
      digest,
    } satisfies z.infer<typeof PasswordResetSchema>,
    "recovery",
  );

  const resetUrl = `${config.URL_PREFIX}/recover-account?token=${token}`;

  const html = await render(
    AccountRecoveryEmailTemplate({ baseUrl: config.URL_PREFIX, resetUrl }),
  );

  await transport.sendMail({
    ...getMailDefaults(),
    to: user.email,
    subject: "Account Recovery",
    text: `An account recovery was requested for your account.\n\nIf you don't recognize this request, you can ignore this.\n\nTo continue: ${resetUrl}`,
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
  assertEmailSupport();

  if (!transport) {
    if (!mailTransport) mailTransport = createMailTransport();
    transport = mailTransport;
  }

  const magicLink = await generateMagicLink(user);

  const html = await render(
    MagicLinkEmailTemplate({
      baseUrl: config.URL_PREFIX,
      magicLinkUrl: magicLink.url,
    }),
  );

  await transport.sendMail({
    ...getMailDefaults(),
    to: user.email,
    subject: "Magic Link for Peated",
    text: `Click the following link to log in to Peated: ${magicLink.url}`,
    html: html,
  });
}

/** Confirms a deletion request and tells the member how to cancel it. */
export async function sendAccountDeletionEmail({
  user,
  deletionScheduledAt,
  transport = mailTransport,
}: {
  user: User;
  deletionScheduledAt: Date;
  transport?: Transporter<SMTPTransport.SentMessageInfo>;
}) {
  assertEmailSupport();

  if (!transport) {
    if (!mailTransport) mailTransport = createMailTransport();
    transport = mailTransport;
  }

  const deletionDate = `${deletionScheduledAt.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  })} UTC`;
  const cancelUrl = `${config.URL_PREFIX}/settings/security`;

  const html = await render(
    AccountDeletionEmailTemplate({
      baseUrl: config.URL_PREFIX,
      deletionDate,
      cancelUrl,
    }),
  );

  await transport.sendMail({
    ...getMailDefaults(),
    to: user.email,
    subject: "Your Peated account will be deleted",
    text: `You asked us to delete your Peated account. It will be deleted on ${deletionDate}. To keep it, sign in and cancel the deletion: ${cancelUrl}`,
    html,
  });
}

export interface ReportEmail {
  id: number;
  /** What was reported, such as "Tasting by @jane.doe". */
  subject: string;
  reasonLabel: string;
  comment: string | null;
  reporterUsername: string;
  contentPreview: string | null;
  /** Path on the web app, or null when the content is gone. */
  contentPath: string | null;
}

/** Tell moderators about a new report. One message per recipient. */
export async function sendReportEmail({
  report,
  to,
  transport = mailTransport,
}: {
  report: ReportEmail;
  to: string[];
  transport?: Transporter<SMTPTransport.SentMessageInfo>;
}) {
  if (!to.length || !hasEmailSupport()) return;

  if (!transport) {
    if (!mailTransport) mailTransport = createMailTransport();
    transport = mailTransport;
  }

  const inboxUrl = `${config.URL_PREFIX}/admin/moderation/inbox/report/${report.id}`;
  const contentUrl = report.contentPath
    ? `${config.URL_PREFIX}${report.contentPath}`
    : null;
  const html = await render(
    NewReportTemplate({
      baseUrl: config.URL_PREFIX,
      report: {
        id: report.id,
        subject: report.subject,
        reasonLabel: report.reasonLabel,
        comment: report.comment,
        reporterUsername: report.reporterUsername,
        contentPreview: report.contentPreview,
        contentUrl,
        inboxUrl,
      },
    }),
  );
  const text = [
    `@${report.reporterUsername} reported ${report.subject} for ${report.reasonLabel}.`,
    report.comment ? `"${report.comment}"` : null,
    `Review it in Moderation: ${inboxUrl}`,
    contentUrl ? `View the reported content: ${contentUrl}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n\n");

  logInfo("Sending report email for report {reportId}", {
    extra: { reportId: report.id, recipients: to.length },
  });

  for (const email of to) {
    try {
      await transport.sendMail({
        ...getMailDefaults(),
        to: email,
        subject: `New report: ${report.subject}`,
        text,
        html,
      });
    } catch (err) {
      logError(err);
    }
  }
}

function getMailDefaults() {
  return {
    from: `"${config.SMTP_FROM_NAME}" <${config.SMTP_FROM}>`,
    replyTo: `"${config.SMTP_FROM_NAME}" <${config.SMTP_REPLY_TO || config.SMTP_FROM}>`,
  };
}
