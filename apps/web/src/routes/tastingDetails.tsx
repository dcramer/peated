import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../components/button";
import Fieldset from "../components/fieldset";
import FormField from "../components/formField";
import Layout from "../components/layout";
import QueryBoundary from "../components/queryBoundary";
import TastingListItem from "../components/tastingListItem";
import TextArea from "../components/textArea";
import TimeSince from "../components/timeSince";
import UserAvatar from "../components/userAvatar";
import useAuth from "../hooks/useAuth";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import { Comment, Paginated, Tasting, User } from "../types";

const CommentForm = ({
  tastingId,
  user,
  onComment,
}: {
  tastingId: string;
  user: User;
  onComment: (comment: Comment) => void;
}) => {
  const [formData, setFormData] = useState({
    comment: "",
  });
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex items-start space-x-4">
      <div className="flex-shrink-0">
        <UserAvatar user={user} size={36} />
      </div>
      <div className="min-w-0 flex-1">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();

            if (saving) return;
            setSaving(true);

            api
              .post(`/tastings/${tastingId}/comments`, {
                data: { ...formData, createdAt: new Date().toISOString() },
              })
              .then((newComment) => {
                onComment({
                  ...newComment,
                  createdBy: user,
                });
                setFormData({ comment: "" });
                setSaving(false);
              })
              .catch((err) => {
                console.error(err);
              });
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

          <div className="absolute inset-x-0 bottom-0 flex justify-between py-2 pl-3 pr-2">
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
  user?: User;
  tastingId: string;
  newValues?: Comment[];
}) => {
  const { data } = useSuspenseQuery(
    ["comments", tastingId],
    (): Promise<Paginated<Comment>> =>
      api.get(`/comments`, { query: { tasting: tastingId } }),
  );

  const [deleted, setDeleted] = useState<string[]>([]);

  return (
    <ul className="my-4 space-y-4">
      <AnimatePresence>
        {[...data.results, ...newValues].map((c) => {
          if (deleted.indexOf(c.id) !== -1) return null;
          const isAuthor = user?.id === c.createdBy.id;
          return (
            <motion.li
              layout
              key={c.id}
              className="relative flex items-start space-x-4 text-white"
            >
              <div className="py-2">
                <UserAvatar size={36} user={c.createdBy} />
              </div>
              <div className="min-w-0 flex-1 rounded bg-slate-900 px-3 py-2">
                <div className="flex flex-row">
                  <div className="flex-1">
                    <div className="text-sm">
                      <Link
                        to={`/users/${c.createdBy.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.createdBy.displayName}
                      </Link>
                    </div>
                    <p className="text-light text-sm">
                      <TimeSince date={c.createdAt} />
                    </p>
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

export default function TastingDetails() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { tastingId } = useParams();
  const { data } = useSuspenseQuery(
    ["tastings", tastingId],
    (): Promise<Tasting> => api.get(`/tastings/${tastingId}`),
  );

  const [newComments, setNewComments] = useState<Comment[]>([]);

  return (
    <Layout gutter>
      <QueryBoundary>
        <ul className="mb-4">
          <TastingListItem
            tasting={data}
            noComment
            onDelete={() => {
              navigate("/");
            }}
          />
        </ul>
      </QueryBoundary>
      {currentUser && (
        <CommentForm
          tastingId={data.id}
          user={currentUser}
          onComment={(comment) => {
            setNewComments((comments) => [...comments, comment]);
          }}
        />
      )}
      <QueryBoundary>
        <CommentList
          user={currentUser}
          tastingId={data.id}
          newValues={newComments}
        />
      </QueryBoundary>
    </Layout>
  );
}
