import type { BotSiteSchema } from "@peated/server/schemas";
import TimeSince from "@peated/web/components/timeSince";
import type { z } from "zod";
import { AdminButton } from "./adminButton.stylex";
import { AdminActions, AdminCode } from "./adminContent.stylex";
import { AdminTable } from "./adminTable.stylex";

type BotSite = z.infer<typeof BotSiteSchema>;

/**
 * Websites PeatedBot treats specially: blocked after a bot wall, or allowed
 * past robots.txt by an admin. The route owns the changes behind each action.
 */
export default function WebsiteAccessTable({
  sites,
  pendingOrigin,
  onClearBlock,
  onRemoveException,
}: {
  sites: BotSite[];
  pendingOrigin: string | null;
  onClearBlock: (origin: string) => void;
  onRemoveException: (origin: string) => void;
}) {
  return (
    <AdminTable
      caption="Website access"
      columns={[
        {
          name: "website",
          showOnMobile: true,
          value: (site) => <AdminCode>{site.origin}</AdminCode>,
        },
        {
          name: "blocked",
          value: (site) =>
            site.blockedAt ? <TimeSince date={site.blockedAt} /> : null,
        },
        {
          name: "reason",
          title: "Robots.txt exception",
          value: (site) =>
            site.robotsException ? (
              <span>
                {site.robotsException.reason}
                {site.robotsException.createdBy
                  ? ` · @${site.robotsException.createdBy.username}`
                  : null}
              </span>
            ) : null,
        },
        {
          align: "right",
          name: "actions",
          title: "",
          showOnMobile: true,
          value: (site) => (
            <AdminActions>
              {site.blockedAt ? (
                <AdminButton
                  size="sm"
                  disabled={pendingOrigin !== null}
                  loading={pendingOrigin === site.origin}
                  onClick={() => onClearBlock(site.origin)}
                >
                  Clear block
                </AdminButton>
              ) : null}
              {site.robotsException ? (
                <AdminButton
                  size="sm"
                  variant="danger"
                  disabled={pendingOrigin !== null}
                  loading={pendingOrigin === site.origin}
                  onClick={() => onRemoveException(site.origin)}
                >
                  Remove exception
                </AdminButton>
              ) : null}
            </AdminActions>
          ),
        },
      ]}
      items={sites}
      primaryKey={(site) => site.origin}
    />
  );
}
