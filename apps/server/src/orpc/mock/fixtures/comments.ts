import type { MockOutputs } from "../contract";
import { timestamp } from "./constants";
import { mockFriends, mockPublicUser } from "./users";

type Comment = MockOutputs["comments"]["list"]["results"][number];

export const mockComment = {
  id: 9803,
  comment: "The smoke opens up after a few minutes in the glass.",
  createdAt: timestamp,
  createdBy: mockPublicUser,
} satisfies Comment;

export const mockComments = [
  mockComment,
  {
    id: 9820,
    comment: "I get grilled pineapple behind the peat on this one.",
    createdAt: "2026-08-25T18:20:00.000Z",
    createdBy: mockFriends[0]!,
  },
  {
    id: 9821,
    comment: "A small splash of water brings out more citrus.",
    createdAt: "2026-08-25T18:35:00.000Z",
    createdBy: mockFriends[1]!,
  },
  {
    id: 9822,
    comment: "The sherry oak feels drier than I expected.",
    createdAt: "2026-08-22T20:15:00.000Z",
    createdBy: mockPublicUser,
  },
  {
    id: 9823,
    comment: "Great contrast between the caramel and mint notes.",
    createdAt: "2026-08-19T19:45:00.000Z",
    createdBy: mockFriends[0]!,
  },
] satisfies Comment[];

export const mockCommentsByTasting = new Map<number, Comment[]>([
  [9601, mockComments.slice(0, 3)],
  [9602, [mockComments[3]!]],
  [9604, [mockComments[4]!]],
]);
