import { type Bottle } from "@peated/server/types";
import BottleIcon from "@peated/web/components/assets/Bottle";
import { Link } from "@remix-run/react";
import { formatCategoryName } from "../lib/strings";
import BottleMetadata from "./bottleMetadata";
import Button from "./button";
import PageHeader from "./pageHeader";
import SidePanel, { SidePanelHeader } from "./sidePanel";

export default function BottlePanel({
  bottle,
  onClose,
  tastingPath,
}: {
  bottle: Bottle;
  tastingPath?: string;
  onClose: () => void;
}) {
  return (
    <SidePanel onClose={onClose}>
      <SidePanelHeader>
        <PageHeader
          icon={BottleIcon}
          title={bottle.fullName}
          titleExtra={
            <BottleMetadata
              data={bottle}
              className="w-full truncate text-center text-slate-500 lg:text-left"
            />
          }
          metadata={
            (bottle.category || bottle.statedAge) && (
              <div className="flex w-full min-w-[150px] flex-col items-center justify-center gap-x-1 text-slate-500 lg:w-auto lg:items-end">
                <div>
                  {bottle.category && (
                    <Link
                      to={`/bottles?category=${encodeURIComponent(
                        bottle.category,
                      )}`}
                    >
                      {formatCategoryName(bottle.category)}
                    </Link>
                  )}
                </div>
                <div>
                  {bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
                </div>
              </div>
            )
          }
        />
      </SidePanelHeader>
      <Button
        color="highlight"
        size="small"
        to={tastingPath ?? `/bottles/${bottle.id}/addTasting`}
      >
        Record Tasting
      </Button>
    </SidePanel>
  );
}
