import { MAX_FILESIZE } from "@peated/server/constants";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import ImageField from "@peated/web/components/imageField";
import Layout from "@peated/web/components/layout";
import useApi from "@peated/web/hooks/useApi";
import { ApiError } from "@peated/web/lib/api";
import { redirectToAuth } from "@peated/web/lib/auth";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import {
  unstable_createFileUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { useActionData, useLoaderData, useNavigate } from "@remix-run/react";
import { json, redirect } from "@remix-run/server-runtime";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import invariant from "tiny-invariant";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export async function action({ context, request, params }: ActionFunctionArgs) {
  invariant(params.tastingId);

  const uploadHandler = unstable_createFileUploadHandler({
    maxPartSize: MAX_FILESIZE,
  });

  const formData =
    (request.headers.get("Content-Type") || "").indexOf(
      "application/x-www-form-urlencoded",
    ) === 0
      ? await request.formData()
      : await unstable_parseMultipartFormData(request, uploadHandler);

  // TODO: move to queries
  const image = formData.get("image");
  if (!image) {
    await context.api.delete(`/tastings/${params.tastingId}/image`);
  } else {
    try {
      await context.api.post(`/tastings/${params.tastingId}/image`, {
        data: {
          image,
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        return json({ error: err.message });
      } else {
        const errorId = logError(err);
        return json({ error: "Internal server error", errorId });
      }
    }
  }
  return redirect(`/tastings/${params.tastingId}`);
}

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, params: { tastingId }, context: { queryUtils, user } }) => {
    invariant(tastingId);
    if (!user) return redirectToAuth({ request });

    return {
      tasting: await queryUtils.tastingById.ensureData(Number(tastingId)),
    };
  },
);

export const meta: MetaFunction = () => {
  return [
    {
      title: "Edit Tasting Image",
    },
  ];
};

export default function EditTastingImage() {
  const { error } = useActionData<typeof action>() || {};
  const { tasting } = useLoaderData<typeof loader>();
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const saveTastingImage = useMutation({
    mutationFn: async () => {
      if (!image) {
        await api.delete(`/tastings/${tasting.id}/image`);
      } else {
        const blob = await toBlob(image, 0.8);
        try {
          await api.post(`/tastings/${tasting.id}/image`, {
            data: {
              image: blob,
            },
          });
        } catch (err) {
          if (err instanceof ApiError) {
            return json({ error: err.message });
          } else {
            const errorId = logError(err);
            return json({ error: "Internal server error", errorId });
          }
        }
      }
      return image;
    },
  });

  const [image, setImage] = useState<HTMLCanvasElement | null>(null);

  const {
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Record<string, never>>({});

  const onSubmit: SubmitHandler<Record<string, never>> = async () => {
    await saveTastingImage.mutateAsync(undefined, {
      onSuccess: () => navigate(`/tastings/${tasting.id}`),
    });
  };

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title="Edit Tasting Image"
            onSave={handleSubmit(onSubmit)}
            saveDisabled={isSubmitting}
          />
        </Header>
      }
      footer={null}
    >
      <Form
        className="w-full max-w-xl self-center bg-slate-950 pb-6 sm:my-6"
        onSubmit={handleSubmit(onSubmit)}
        isSubmitting={isSubmitting}
      >
        {error && <FormError values={[error]} />}

        <Fieldset>
          <ImageField
            name="image"
            label="Picture"
            value={tasting.imageUrl}
            onChange={(value) => setImage(value)}
            imageWidth={1024 / 2}
            imageHeight={768 / 2}
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
