import type { MockOutputs } from "../contract";
import { mockBottles } from "./bottles";
import { mockEntities } from "./entities";
import { mockPublicUser } from "./users";

export const mockChanges = [
  {
    id: 9940,
    objectId: mockBottles[0]!.id,
    objectType: "bottle",
    displayName: mockBottles[0]!.fullName,
    type: "update",
    createdByActor: {
      id: 9941,
      type: "user",
      key: String(mockPublicUser.id),
      displayName: mockPublicUser.username,
      pictureUrl: mockPublicUser.pictureUrl,
      user: mockPublicUser,
    },
    createdAt: "2026-08-26T08:00:00.000Z",
    data: { description: { previous: null, current: "Updated description" } },
  },
  {
    id: 9942,
    objectId: mockEntities[4]!.id,
    objectType: "entity",
    displayName: mockEntities[4]!.name,
    type: "update",
    createdByActor: {
      id: 9943,
      type: "system",
      key: "catalog-sync",
      displayName: "Catalog sync",
      pictureUrl: null,
      user: null,
    },
    createdAt: "2026-08-24T14:00:00.000Z",
    data: { website: { previous: null, current: mockEntities[4]!.website } },
  },
  {
    id: 9944,
    objectId: mockBottles[5]!.id,
    objectType: "bottle",
    displayName: mockBottles[5]!.fullName,
    type: "add",
    createdByActor: {
      id: 9941,
      type: "user",
      key: String(mockPublicUser.id),
      displayName: mockPublicUser.username,
      pictureUrl: mockPublicUser.pictureUrl,
      user: mockPublicUser,
    },
    createdAt: "2026-08-20T11:00:00.000Z",
    data: {},
  },
] satisfies MockOutputs["changes"]["list"]["results"];
