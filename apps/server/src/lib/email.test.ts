import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { bottleGroups, bottleTombstones } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import type { Transporter } from "nodemailer";
import { createTransport } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import {
  notifyComment,
  sendAccountDeletionEmail,
  sendMagicLinkEmail,
  sendReportEmail,
} from "./email";

let transport: Transporter<SMTPTransport.SentMessageInfo>;
let outbox: Mail.Options[];

// const mailConfig = {
//   to: "test@example.com",
// };

const createEmailTestHarness = () => {
  const outbox: Mail.Options[] = [];
  const testTransport: SMTPTransport | SMTPTransport.Options = {
    name: "test",
    version: "0.1.0",
    send: (mail, callback) => {
      const input = mail.message.createReadStream();
      const envelope = mail.message.getEnvelope();
      const messageId = mail.message.messageId();

      input.on("readable", () => {
        input.read();
      });
      input.on("end", function () {
        const info = {
          envelope,
          messageId,
          accepted: [],
          rejected: [],
          pending: [],
          response: "ok",
        };
        callback(null, info);
      });

      outbox.push(mail.data);
    },
  };

  return {
    transport: createTransport(testTransport),
    outbox: outbox,
  };
};

beforeEach(async () => {
  config.API_SERVER = "http://localhost";
  config.SMTP_HOST = "localhost";
  config.SMTP_FROM = "example@example.com";

  const harness = createEmailTestHarness();
  transport = harness.transport;
  outbox = harness.outbox;
});

describe("notifyComment", () => {
  test("doesnt notify author", async ({ fixtures }) => {
    const author = await fixtures.User({
      email: "joe@example.com",
      verified: true,
    });
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: author.id,
    });
    const comment = await fixtures.Comment({
      tastingId: tasting.id,
      comment: "**An Comment** on _life_",
      createdById: author.id,
    });

    await notifyComment({
      comment: {
        ...comment,
        createdBy: author,
        tasting: {
          ...tasting,
          createdBy: author,
        },
      },
      transport,
    });
    expect(outbox.length).toBe(0);
  });

  test("renders the exact Bottle label", async ({ fixtures }) => {
    const otherAuthor = await fixtures.User({
      verified: true,
    });
    const author = await fixtures.User({
      email: "joe@example.com",
      verified: true,
    });
    const brand = await fixtures.Entity({ name: "Exact Email Brand" });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Exact Email Bottle",
    });
    const groupLabel = "Distinct Exact Email Group Label";
    await db
      .update(bottleGroups)
      .set({ fullName: groupLabel })
      .where(eq(bottleGroups.id, bottle.groupId));
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: author.id,
    });
    const comment = await fixtures.Comment({
      tastingId: tasting.id,
      comment: "**An Comment** on _life_",
      createdById: otherAuthor.id,
    });

    await notifyComment({
      comment: {
        ...comment,
        createdBy: otherAuthor,
        tasting: {
          ...tasting,
          createdBy: author,
        },
      },
      transport,
    });
    expect(outbox.length).toBe(1);
    const msg = outbox[0];
    expect(msg.to).toBe(author.email);
    expect(msg.subject).toBe("New Comment on Tasting");
    expect(msg.html).toContain(bottle.fullName);
    expect(msg.html).not.toContain(groupLabel);
    expect(msg.text).toContain(bottle.fullName);
    expect(msg.text).not.toContain(groupLabel);
  });

  test("rejects a retired Bottle", async ({ fixtures }) => {
    const otherAuthor = await fixtures.User({ verified: true });
    const author = await fixtures.User({
      email: "joe@example.com",
      verified: true,
    });
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: author.id,
    });
    const comment = await fixtures.Comment({
      tastingId: tasting.id,
      createdById: otherAuthor.id,
    });
    await db.insert(bottleTombstones).values({ bottleId: bottle.id });

    await expect(
      notifyComment({
        comment: {
          ...comment,
          createdBy: otherAuthor,
          tasting: { ...tasting, createdBy: author },
        },
        transport,
      }),
    ).rejects.toMatchObject({
      reason: "bottle_retired",
      bottleId: bottle.id,
    });
    expect(outbox).toHaveLength(0);
  });
});

describe("sendMagicLinkEmail", () => {
  test("requires SendGrid SMTP credentials", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true });
    const originalHost = config.SMTP_HOST;
    const originalUser = config.SMTP_USER;
    const originalPass = config.SMTP_PASS;

    config.SMTP_HOST = "smtp.sendgrid.net";
    config.SMTP_USER = undefined;
    config.SMTP_PASS = undefined;

    try {
      await expect(sendMagicLinkEmail({ user, transport })).rejects.toThrow(
        "SMTP credentials are not configured",
      );
      expect(outbox.length).toBe(0);
    } finally {
      config.SMTP_HOST = originalHost;
      config.SMTP_USER = originalUser;
      config.SMTP_PASS = originalPass;
    }
  });
});

describe("sendAccountDeletionEmail", () => {
  test("tells the member when deletion runs and how to cancel", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ email: "joe@example.com" });
    const originalUrlPrefix = config.URL_PREFIX;
    config.URL_PREFIX = "https://peated.example";

    try {
      await sendAccountDeletionEmail({
        user,
        deletionScheduledAt: new Date("2026-09-22T18:00:00Z"),
        transport,
      });
    } finally {
      config.URL_PREFIX = originalUrlPrefix;
    }

    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      to: "joe@example.com",
      subject: "Your Peated account will be deleted",
    });
    expect(outbox[0].text).toContain("September 22, 2026 at 6:00 PM UTC");
    expect(outbox[0].text).toContain(
      "https://peated.example/settings/security",
    );
  });
});

describe("sendReportEmail", () => {
  test("sends one message per moderator with the Inbox link", async () => {
    config.URL_PREFIX = "https://peated.test";
    await sendReportEmail({
      to: ["mod@example.com", "admin@example.com"],
      report: {
        id: 12,
        subject: "Bottle: Fake Distillery 12-year-old",
        reasonLabel: "Wrong or made-up information",
        comment: "This distillery does not exist.",
        reporterUsername: "islay.fan",
        contentPreview: "Fake Distillery 12-year-old",
        contentPath: "/bottles/99",
      },
      transport,
    });

    expect(outbox.map((mail) => mail.to)).toEqual([
      "mod@example.com",
      "admin@example.com",
    ]);
    const [msg] = outbox;
    expect(msg.subject).toBe("New report: Bottle: Fake Distillery 12-year-old");
    expect(msg.text).toContain(
      "https://peated.test/admin/moderation/inbox/report/12",
    );
    expect(msg.text).toContain("https://peated.test/bottles/99");
    expect(msg.html).toContain("This distillery does not exist.");
  });

  test("sends nothing without recipients", async () => {
    await sendReportEmail({
      to: [],
      report: {
        id: 1,
        subject: "Member @x",
        reasonLabel: "Spam or advertising",
        comment: null,
        reporterUsername: "y",
        contentPreview: null,
        contentPath: null,
      },
      transport,
    });
    expect(outbox).toHaveLength(0);
  });
});
