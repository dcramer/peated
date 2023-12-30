import type { Comment, User } from "@peated/server/types";
import Button from "@peated/web/components/button";
import CommentEntry from "@peated/web/components/commentEntry";
import EmbeddedLogin from "@peated/web/components/embeddedLogin";
import Fieldset from "@peated/web/components/fieldset";
import FormField from "@peated/web/components/formField";
import Layout from "@peated/web/components/layout";
import QueryBoundary from "@peated/web/components/queryBoundary";
import TastingListItem from "@peated/web/components/tastingListItem";
import TextArea from "@peated/web/components/textArea";
import UserAvatar from "@peated/web/components/userAvatar";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc";
import type { MetaFunction } from "@remix-run/react";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { json } from "@remix-run/server-runtime";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import invariant from "tiny-invariant";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params: { tastingId }, context: { trpc } }) => {
    invariant(tastingId);

    return json({ tasting: await trpc.tastingById.query(Number(tastingId)) });
  },
);

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [];

  const title = `${data.tasting.bottle.fullName} - Tasting Notes by ${data.tasting.createdBy.username}`;

  const meta: Record<string, any>[] = [
    {
      title,
    },
    {
      property: "og:title",
      content: title,
    },
  ];

  if (data.tasting.imageUrl) {
    meta.push(
      {
        property: "og:image",
        content: data.tasting.imageUrl,
      },
      {
        property: "twitter:card",
        content: "summary_large_image",
      },
    );
  }

  return meta;
};

export default function TastingDetails() {
  const { tasting } = useLoaderData<typeof loader>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [newComments, setNewComments] = useState<Comment[]>([]);

  return (
    <Layout>
      <QueryBoundary>
        <ul className="mb-4">
          <TastingListItem
            tasting={tasting}
            noCommentAction
            hideNotes
            onDelete={() => {
              navigate("/");
            }}
          />
        </ul>
      </QueryBoundary>
      {user ? (
        <CommentForm
          tastingId={tasting.id}
          user={user}
          onComment={(comment) => {
            setNewComments((comments) => [...comments, comment]);
          }}
        />
      ) : (
        <EmbeddedLogin />
      )}

      <ul className="my-4 space-y-4 px-3 sm:px-2">
        {!!tasting.notes && (
          <CommentEntry
            className="relative flex items-start space-x-2 text-white"
            createdAt={tasting.createdAt}
            createdBy={tasting.createdBy}
            text={tasting.notes}
          />
        )}
        <QueryBoundary>
          <CommentList
            user={user}
            tastingId={tasting.id}
            newValues={newComments}
          />
        </QueryBoundary>
      </ul>
    </Layout>
  );
}

const CommentForm = ({
  tastingId,
  user,
  onComment,
}: {
  tastingId: number;
  user: User;
  onComment: (comment: Comment) => void;
}) => {
  const commentCreateMutation = trpc.commentCreate.useMutation();

  const [formData, setFormData] = useState({
    comment: "",
  });
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex items-start space-x-2 px-3 sm:px-2">
      <div className="h-8 w-8 flex-shrink-0">
        <UserAvatar size={32} user={user} />
      </div>
      <div className="min-w-0 flex-auto">
        <form
          className="relative"
          onSubmit={async (e) => {
            e.preventDefault();

            if (saving) return;
            setSaving(true);

            const newComment = await commentCreateMutation.mutateAsync({
              ...formData,
              tasting: tastingId,
              createdAt: new Date().toISOString(),
            });

            onComment({
              ...newComment,
              createdBy: user,
            });
            setFormData({ comment: "" });
            setSaving(false);
          }}
        >
          <Fieldset>
            <FormField className="border border-slate-700">
              <label htmlFor="comment" className="sr-only">
                Add your comment
              </label>
              <TextArea
                rows={3}
                name="comment"
                id="comment"
                required
                placeholder="How envious are you?"
                value={formData.comment}
                onChange={(e) =>
                  setFormData((formData) => ({
                    ...formData,
                    comment: e.target.value,
                  }))
                }
              />

              {/* Spacer element to match the height of the toolbar */}
              <div className="py-2" aria-hidden="true">
                {/* Matches height of button in toolbar (1px border + 36px content height) */}
                <div className="py-px">
                  <div className="h-9" />
                </div>
              </div>
            </FormField>
          </Fieldset>

          <div className="absolute inset-x-0 bottom-0 z-10 flex justify-between py-2 pl-3 pr-2">
            <div className="flex-shrink-0">
              <Button type="submit" color="primary" disabled={saving}>
                Post Comment
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const CommentList = ({
  user,
  tastingId,
  newValues = [],
}: {
  user?: User | null;
  tastingId: number;
  newValues?: Comment[];
}) => {
  const { data } = trpc.commentList.useQuery({
    tasting: tastingId,
  });
  const commentDeleteMutation = trpc.commentDelete.useMutation({
    onSuccess: (_data, input) => {
      setDeleted((a) => [...a, input]);
    },
  });

  const [deleted, setDeleted] = useState<number[]>([]);

  if (!data) return;

  return (
    <AnimatePresence>
      {[...data.results, ...newValues].map((c) => {
        if (deleted.includes(c.id)) return null;
        const isAuthor = user?.id === c.createdBy.id;
        return (
          <CommentEntry
            as={motion.li}
            layout
            key={c.id}
            className="relative flex items-start space-x-2 text-white"
            createdAt={c.createdAt}
            createdBy={c.createdBy}
            text={c.comment}
            canDelete={user?.admin || isAuthor}
            onDelete={() => commentDeleteMutation.mutate(c.id)}
          />
        );
      })}
    </AnimatePresence>
  );
};
