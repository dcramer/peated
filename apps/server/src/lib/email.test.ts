import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottleTombstones,
  catalogTargets,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import type { Transporter } from "nodemailer";
import { createTransport } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { notifyComment, sendMagicLinkEmail } from "./email";

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
    const bottle = await fixtures.Bottle();
    const groupLabel = "Distinct Exact Email Group Label";
    await db
      .update(bottleGroups)
      .set({ fullName: groupLabel })
      .where(eq(bottleGroups.id, bottle.groupId as number));
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
    expect(msg.html).not.toContain("Exact bottle not specified");
    expect(msg.text).toContain(bottle.fullName);
    expect(msg.text).not.toContain(groupLabel);
    expect(msg.text).not.toContain("Exact bottle not specified");
  });

  test("renders the generic BottleGroup label without choosing a Bottle", async ({
    fixtures,
  }) => {
    const otherAuthor = await fixtures.User({ verified: true });
    const author = await fixtures.User({
      email: "joe@example.com",
      verified: true,
    });
    const bottle = await fixtures.Bottle({ name: "Exact Label" });
    const groupLabel = "Generic Email Label";
    await db
      .update(bottleGroups)
      .set({ fullName: groupLabel })
      .where(eq(bottleGroups.id, bottle.groupId as number));
    const groupTarget = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { and, eq, isNull }) =>
        and(
          eq(catalogTargets.groupId, bottle.groupId as number),
          isNull(catalogTargets.bottleId),
        ),
      with: { group: true },
    });
    if (!groupTarget) throw new Error("Missing generic target fixture");
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: groupTarget.id,
      createdById: author.id,
    });
    const comment = await fixtures.Comment({
      tastingId: tasting.id,
      comment: "Generic target comment",
      createdById: otherAuthor.id,
    });

    await notifyComment({
      comment: {
        ...comment,
        createdBy: otherAuthor,
        tasting: { ...tasting, createdBy: author },
      },
      transport,
    });

    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.html).toContain(groupLabel);
    expect(outbox[0]?.html).not.toContain(bottle.fullName);
    expect(outbox[0]?.html).toContain("Exact bottle not specified");
    expect(outbox[0]?.text).toContain(groupLabel);
    expect(outbox[0]?.text).not.toContain(bottle.fullName);
    expect(outbox[0]?.text).toContain("Exact bottle not specified");
  });

  test("rejects a targetless tasting", async ({ fixtures }) => {
    const otherAuthor = await fixtures.User({ verified: true });
    const author = await fixtures.User({
      email: "joe@example.com",
      verified: true,
    });
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: null,
      createdById: author.id,
    });
    const comment = await fixtures.Comment({
      tastingId: tasting.id,
      createdById: otherAuthor.id,
    });

    await expect(
      notifyComment({
        comment: {
          ...comment,
          createdBy: otherAuthor,
          tasting: { ...tasting, createdBy: author },
        },
        transport,
      }),
    ).rejects.toThrow(`Tasting ${tasting.id} has no CatalogTarget`);
    expect(outbox).toHaveLength(0);
  });

  test("rejects a retired exact target", async ({ fixtures }) => {
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
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    if (!target) throw new Error("Missing exact target fixture");
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
      code: "CATALOG_TARGET_RETIRED",
      identity: { bottleId: bottle.id },
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
