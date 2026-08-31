"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDuration } from "../../lib/format";
import { getFormErrorMessage } from "../../lib/formHelpers";
import { useORPC } from "../../lib/orpc/context";
import { colors, fonts, space } from "../../styles/tokens.stylex";
import TimeSince from "../timeSince";
import { AdminButton } from "./adminButton.stylex";
import {
  AdminFormError,
  AdminFormGrid,
  AdminSelectField,
  AdminTextField,
} from "./adminForm.stylex";
import { AdminDefinitionList as DefinitionList } from "./adminUtility.stylex";
import ScraperSetting from "./scraperSetting.stylex";

type Site = Outputs["externalSites"]["healthDetails"];
export type ScheduleChoice = "manual" | "daily" | "weekly" | "custom";

const DAILY_MINUTES = 1_440;
const WEEKLY_MINUTES = 10_080;

export function getScheduleChoice(runEvery: number | null): ScheduleChoice {
  if (runEvery === null) return "manual";
  if (runEvery === DAILY_MINUTES) return "daily";
  if (runEvery === WEEKLY_MINUTES) return "weekly";
  return "custom";
}

export function getScheduleInterval(
  choice: ScheduleChoice,
  customMinutes: number,
) {
  if (choice === "manual") return null;
  if (choice === "daily") return DAILY_MINUTES;
  if (choice === "weekly") return WEEKLY_MINUTES;
  return customMinutes;
}

function parseScheduleChoice(value: string): ScheduleChoice {
  if (
    value === "manual" ||
    value === "daily" ||
    value === "weekly" ||
    value === "custom"
  ) {
    return value;
  }
  throw new Error("Unknown scraper schedule.");
}

export default function ScraperScheduleSettings({ site }: { site: Site }) {
  const initialChoice = getScheduleChoice(site.runEvery);
  const [choice, setChoice] = useState<ScheduleChoice>(initialChoice);
  const [customMinutes, setCustomMinutes] = useState(
    initialChoice === "custom" ? String(site.runEvery) : "60",
  );
  const [error, setError] = useState<string>();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const update = useMutation(
    orpc.externalSites.schedule.update.mutationOptions(),
  );
  const parsedCustomMinutes = Number(customMinutes);
  const invalidCustom =
    choice === "custom" &&
    (!Number.isInteger(parsedCustomMinutes) || parsedCustomMinutes <= 0);
  const automaticUnavailable = choice !== "manual" && !site.runtime.registered;

  async function save() {
    setError(undefined);
    try {
      await update.mutateAsync({
        site: site.type,
        schedule: {
          runEvery: getScheduleInterval(choice, parsedCustomMinutes),
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.externalSites.healthDetails.key({
            input: { site: site.type },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.externalSites.healthList.key(),
        }),
      ]);
    } catch (caught) {
      setError(getFormErrorMessage(caught));
    }
  }

  return (
    <ScraperSetting
      title="Schedule"
      description="Choose when this scraper runs. You can still run it manually."
      action={
        <AdminButton
          variant="accent"
          disabled={update.isPending || invalidCustom || automaticUnavailable}
          loading={update.isPending}
          title={
            automaticUnavailable
              ? "Set up this scraper before you schedule automatic runs."
              : undefined
          }
          onClick={() => void save()}
        >
          Save schedule
        </AdminButton>
      }
    >
      {error ? <AdminFormError values={[error]} /> : null}
      <DefinitionList>
        <DefinitionList.Term>Current</DefinitionList.Term>
        <DefinitionList.Details>
          {site.runEvery === null
            ? "Manual"
            : `Every ${formatDuration(site.runEvery * 60_000)}`}
        </DefinitionList.Details>
        <DefinitionList.Term>Next run</DefinitionList.Term>
        <DefinitionList.Details>
          {site.nextRunAt ? (
            <TimeSince date={site.nextRunAt} />
          ) : site.runEvery === null ? (
            "Not scheduled"
          ) : (
            "Due now"
          )}
        </DefinitionList.Details>
      </DefinitionList>
      <AdminFormGrid>
        <AdminSelectField
          label="Run schedule"
          name="schedule"
          value={choice}
          onChange={(event) =>
            setChoice(parseScheduleChoice(event.target.value))
          }
          options={[
            { label: "Manual only", value: "manual" },
            { label: "Every day", value: "daily" },
            { label: "Every week", value: "weekly" },
            { label: "Custom", value: "custom" },
          ]}
          required
        />
        {choice === "custom" ? (
          <AdminTextField
            label="Run every"
            name="customMinutes"
            type="number"
            min={1}
            step={1}
            value={customMinutes}
            suffixLabel="minutes"
            onChange={(event) => setCustomMinutes(event.target.value)}
            required
          />
        ) : null}
      </AdminFormGrid>
      {automaticUnavailable ? (
        <p {...stylex.props(styles.help)}>
          Set up this scraper before you schedule automatic runs.
        </p>
      ) : null}
    </ScraperSetting>
  );
}

const styles = stylex.create({
  help: {
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
  },
});
