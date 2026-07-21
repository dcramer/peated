import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { loadCatalogTarget } from "@peated/server/lib/catalogTargets";
import { formatColor } from "@peated/server/lib/format";
import { logError, logWarn } from "@peated/server/lib/log";
import { absoluteUrl } from "@peated/server/lib/urls";

if (!config.DISCORD_WEBHOOK) {
  logWarn("DISCORD_WEBHOOK is not configured", {});
}

export default async function ({ tastingId }: { tastingId: number }) {
  if (!config.DISCORD_WEBHOOK) {
    return;
  }

  const tasting = await db.query.tastings.findFirst({
    where: (tastings, { eq }) => eq(tastings.id, tastingId),
    with: {
      createdBy: true,
    },
  });
  if (!tasting) {
    throw new Error(`Unknown tasting: ${tastingId}`);
  }
  if (tasting.targetId === null) {
    throw new Error(`Tasting ${tastingId} has no CatalogTarget`);
  }

  const target = await loadCatalogTarget(tasting.targetId, {
    actor: null,
    permissions: { canReadCatalogIdentity: true },
  });
  const targetLabel =
    target.kind === "bottle" ? target.bottle.fullName : target.group.fullName;

  // TODO: pretty sure we're mismatched timezones on db + server, and need normalization
  // move db to UTC (if its not, or if its not storing tzinfo), and then run all these checks
  // against UTC time
  // if (Math.abs(new Date().getTime() - tasting.createdAt.getTime()) > 300) {
  //   throw new Error("Tasting is too old; Not notifying");
  // }

  const fields = [];
  if (target.kind === "group")
    fields.push({
      name: "Bottle",
      value: "Exact bottle not specified",
      inline: true,
    });

  if (tasting.rating !== null)
    fields.push({
      name: "Rating",
      value: `${tasting.rating}`,
      inline: true,
    });

  if (tasting.tags)
    fields.push({
      name: "Notes",
      value: tasting.tags.join(", "),
      inline: true,
    });

  if (tasting.servingStyle)
    fields.push({
      name: "Serving Style",
      value: tasting.servingStyle,
      inline: true,
    });

  if (tasting.color)
    fields.push({
      name: "Color",
      value: formatColor(tasting.color),
      inline: true,
    });

  const payload = {
    username: "Peated",
    embeds: [
      {
        author: {
          name: tasting.createdBy.username,
          url: `${config.URL_PREFIX}/users/${encodeURIComponent(
            tasting.createdBy.username,
          )}`,
          icon_url: tasting.createdBy.pictureUrl
            ? absoluteUrl(config.API_SERVER, tasting.createdBy.pictureUrl)
            : null,
        },
        title: targetLabel,
        url: `${config.URL_PREFIX}/tastings/${tasting.id}`,
        description: tasting.notes || null,
        fields,
        image: tasting.imageUrl
          ? {
              url: absoluteUrl(config.API_SERVER, tasting.imageUrl),
            }
          : null,
      },
    ],
  };

  const body = JSON.stringify(payload);

  const response = await fetch(config.DISCORD_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
  if (response.status >= 400) {
    const data = await response.json();
    logError(
      `Error sending Discord webhook: ${response.status}`,
      {
        discord: {
          statusCode: response.status,
          data,
        },
      },
      {
        "payload.json": body,
      },
    );
  }
}
