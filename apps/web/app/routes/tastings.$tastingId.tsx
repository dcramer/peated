import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import type { Paginated } from "@peated/shared/types";
import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useNavigate } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import invariant from "tiny-invariant";
import Button from "~/components/button";
import EmbeddedLogin from "~/components/embeddedLogin";
import Fieldset from "~/components/fieldset";
import FormField from "~/components/formField";
import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import TastingListItem from "~/components/tastingListItem";
import TextArea from "~/components/textArea";
import TimeSince from "~/components/timeSince";
import UserAvatar from "~/components/userAvatar";
import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";
import type { Comment, Tasting, User } from "~/types";

const CommentForm = ({
  tastingId,
  user,
  onComment,
}: {
  tastingId: number;
  user: User;
  onComment: (comment: Comment) => void;
}) => {
  const api = useApi();

  const [formData, setFormData] = useState({
    comment: "",
  });
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex items-start space-x-2 px-3 sm:px-2">
      <div className="h-8 w-8 flex-shrink-0">
        <UserAvatar size={32} user={user} />
      </div>
      <div className="min-w-0 flex-1">
        <form
          className="relative"
          onSubmit={async (e) => {
            e.preventDefault();

            if (saving) return;
            setSaving(true);

            const newComment = await api.post(
              `/tastings/${tastingId}/comments`,
              {
                data: { ...formData, createdAt: new Date().toISOString() },
              },
            );

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
  const api = useApi();

  const { data } = useQuery(
    ["comments", tastingId],
    (): Promise<Paginated<Comment>> =>
      api.get(`/comments`, { query: { tasting: tastingId } }),
  );

  const [deleted, setDeleted] = useState<number[]>([]);

  if (!data) return;

  return (
    <ul className="my-4 space-y-4 px-3 sm:px-2">
      <AnimatePresence>
        {[...data.results, ...newValues].map((c) => {
          if (deleted.indexOf(c.id) !== -1) return null;
          const isAuthor = user?.id === c.createdBy.id;
          return (
            <motion.li
              layout
              key={c.id}
              className="relative flex items-start space-x-2 text-white"
            >
              <div className="h-10 w-10 py-2 sm:h-12 sm:w-12 ">
                <UserAvatar size={32} user={c.createdBy} />
              </div>
              <div className="min-w-0 flex-1 rounded bg-slate-900 px-3 py-2">
                <div className="flex flex-row">
                  <div className="flex-1">
                    <div className="text-sm">
                      <Link
                        to={`/users/${c.createdBy.username}`}
                        className="font-medium hover:underline"
                      >
                        {c.createdBy.displayName}
                      </Link>
                    </div>
                    <div className="text-light text-sm">
                      <TimeSince date={c.createdAt} />
                    </div>
                  </div>
                  <div>
                    <Menu as="div" className="menu">
                      <Menu.Button as={Button} size="small" color="primary">
                        <EllipsisVerticalIcon className="h-5 w-5" />
                      </Menu.Button>
                      <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded">
                        {(user?.admin || isAuthor) && (
                          <Menu.Item
                            as="button"
                            onClick={async () => {
                              await api.delete(`/comments/${c.id}`);
                              setDeleted((a) => [...a, c.id]);
                            }}
                          >
                            Delete Comment
                          </Menu.Item>
                        )}
                      </Menu.Items>
                    </Menu>
                  </div>
                </div>
                <div className="mt-4 text-sm">
                  <p>{c.comment}</p>
                </div>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
};

export async function loader({ params, context }: LoaderArgs) {
  invariant(params.tastingId);

  const tasting: Tasting = await context.api.get(
    `/tastings/${params.tastingId}`,
  );

  return json({ tasting });
}

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Tasting Details",
    },
  ];
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
            noComment
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
      <QueryBoundary>
        <CommentList
          user={user}
          tastingId={tasting.id}
          newValues={newComments}
        />
      </QueryBoundary>
    </Layout>
  );
}
