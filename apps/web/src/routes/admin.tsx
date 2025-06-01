import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import ImageField from "@peated/web/components/imageField";
import SimpleHeader from "@peated/web/components/simpleHeader";
import TextField from "@peated/web/components/textField";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute({
  component: Page,
});

function QueueStats() {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.admin.queueInfo.queryOptions({
      refetchInterval: 5000,
    }),
  );

  return (
    <>
      <SimpleHeader>Async Tasks</SimpleHeader>
      <div className="my-6 grid grid-cols-4 items-center gap-3 text-center">
        {Object.entries(data.stats).map(([name, count]) => {
          return (
            <div className="mr-4 pr-3 text-center" key={name}>
              <span className="block text-xl font-bold uppercase tracking-wide text-white">
                {count.toLocaleString()}
              </span>
              <span className="text-muted text-sm">{name}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

type ExtractedLabelData = {
  brand?: string | null;
  distillery?: string[] | null;
  category?: string | null;
  expression?: string | null;
  series?: string | null;
  stated_age?: number | null;
  abv?: number | null;
  release_year?: number | null;
  vintage_year?: number | null;
  cask_type?: string | null;
  edition?: string | null;
};

function LabelTester() {
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const [label, setLabel] = useState<string>("");
  const [result, setResult] = useState<ExtractedLabelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const orpc = useORPC();
  const labelExtract = useMutation(orpc.ai.labelExtract.mutationOptions());

  return (
    <>
      <SimpleHeader>Label Extraction</SimpleHeader>
      <Form
        isSubmitting={loading}
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setResult(null);
          setLoading(true);
          try {
            if (image) {
              const imageData = image.toDataURL("image/webp");
              const result = await labelExtract.mutateAsync({
                imageUrl: imageData,
              });
              setResult(result);
            } else if (label) {
              const result = await labelExtract.mutateAsync({
                label,
              });
              setResult(result);
            }
          } catch (err) {
            console.error(err);
            setError(
              err instanceof Error ? err.message : "Failed to extract label",
            );
          } finally {
            setImage(null);
            setLabel("");
            setLoading(false);
          }
        }}
      >
        <Fieldset>
          <ImageField
            name="image"
            label="Image"
            onChange={(value) => setImage(value)}
          />
          <TextField
            name="label"
            label="Label"
            value={label}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setLabel(e.target.value)
            }
          />
          {result && (
            <div className="mt-4 rounded bg-slate-800 p-4">
              <pre className="whitespace-pre-wrap text-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
          {error && <div className="p-4 text-red-500">{error}</div>}

          <div className="flex justify-end p-4">
            <Button color="primary" type="submit" disabled={!image && !label}>
              Extract
            </Button>
          </div>
        </Fieldset>
      </Form>
    </>
  );
}

function Page() {
  return (
    <>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
        ]}
      />

      <div>
        <QueueStats />
        <LabelTester />
      </div>
    </>
  );
}
