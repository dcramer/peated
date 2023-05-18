import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";

import { readFile } from "fs/promises";
import path from "path";
import { db, first } from "../../db";
import {
  NewBottle,
  NewComment,
  NewEntity,
  NewFollow,
  NewTasting,
  NewToast,
  NewUser,
  User as UserType,
  bottles,
  bottlesToDistillers,
  comments,
  entities,
  follows,
  tastings,
  toasts,
  users,
} from "../../db/schema";
import { createAccessToken } from "../auth";
import { choose, random, sample } from "../rand";
import { defaultTags } from "../tags";

export const User = async ({ ...data }: Partial<NewUser> = {}) => {
  return (
    await db
      .insert(users)
      .values({
        displayName: faker.name.firstName(),
        email: faker.internet.email(),
        username: faker.internet.userName().toLowerCase(),
        admin: false,
        mod: false,
        active: true,
        ...data,
      })
      .returning()
  )[0];
};

export const Follow = async ({ ...data }: Partial<NewFollow> = {}) => {
  return (
    await db
      .insert(follows)
      .values({
        fromUserId: data.fromUserId || (await User()).id,
        toUserId: data.toUserId || (await User()).id,
        status: "following",
        ...data,
      })
      .returning()
  )[0];
};

export const Entity = async ({ ...data }: Partial<NewEntity> = {}) => {
  const name = faker.company.name();
  const existing = first(
    await db.select().from(entities).where(eq(entities.name, name)),
  );
  if (existing) return existing;

  return (
    await db
      .insert(entities)
      .values({
        name,
        country: faker.address.country(),
        type: ["brand", "distiller"],
        ...data,
        createdById: data.createdById || (await User()).id,
      })
      .returning()
  )[0];
};

export const Bottle = async ({
  distillerIds = [],
  ...data
}: Partial<NewBottle> & {
  distillerIds?: number[];
} = {}) => {
  const [bottle] = await db
    .insert(bottles)
    .values({
      name: faker.music.songName(),
      category: choose([
        "blend",
        "bourbon",
        "rye",
        "single_grain",
        "single_malt",
        "spirit",
        undefined,
      ]),
      statedAge: choose([undefined, 3, 10, 12, 15, 18, 20, 25]),
      ...data,
      brandId: data.brandId || (await Entity()).id,
      createdById: data.createdById || (await User()).id,
    })
    .returning();

  if (!distillerIds.length) {
    if (random(0, 1) === 1) {
      await db.insert(bottlesToDistillers).values({
        bottleId: bottle.id,
        distillerId: (await Entity({ type: ["distiller"] })).id,
      });
    }
  } else {
    for (const d of distillerIds) {
      await db.insert(bottlesToDistillers).values({
        bottleId: bottle.id,
        distillerId: d,
      });
    }
  }

  return bottle;
};

export const Tasting = async ({ ...data }: Partial<NewTasting> = {}) => {
  return (
    await db
      .insert(tastings)
      .values({
        notes: faker.lorem.sentence(),
        rating: faker.datatype.float({ min: 1, max: 5 }),
        tags: sample(defaultTags, random(1, 5)),
        ...data,

        bottleId: data.bottleId || (await Bottle()).id,
        createdById: data.createdById || (await User()).id,
      })
      .returning()
  )[0];
};

export const Toast = async ({ ...data }: Partial<NewToast> = {}) => {
  return (
    await db
      .insert(toasts)
      .values({
        createdById: data.createdById || (await User()).id,
        tastingId: data.tastingId || (await Tasting()).id,
        ...data,
      })
      .returning()
  )[0];
};

export const Comment = async ({ ...data }: Partial<NewComment> = {}) => {
  return (
    await db
      .insert(comments)
      .values({
        createdById: data.createdById || (await User()).id,
        tastingId: data.tastingId || (await Tasting()).id,
        comment: faker.lorem.sentences(random(2, 5)),
        ...data,
      })
      .returning()
  )[0];
};

export const AuthToken = async ({ user }: { user?: UserType | null } = {}) => {
  if (!user) user = await User();

  return await createAccessToken(user);
};

export const AuthenticatedHeaders = async ({
  user,
  mod,
  admin,
}: {
  user?: UserType | null;
  mod?: boolean;
  admin?: boolean;
} = {}) => {
  if (!user && admin) {
    user = await User({ admin: true });
  } else if (!user && mod) {
    user = await User({ mod: true });
  }
  return {
    Authorization: `Bearer ${await AuthToken({ user })}`,
  };
};

export const SampleSquareImage = async () => {
  return new Blob([await readFile(await SampleSquareImagePath())]);
};

export const SampleSquareImagePath = async () => {
  return path.join(__dirname, "assets", "sample-square-image.jpg");
};
