import { faker } from "@faker-js/faker";
import { prisma } from "../db";
import {
  Bottle as BottleType,
  Brand as BrandType,
  Checkin as CheckinType,
  Distiller as DistillerType,
  Prisma,
  User as UserType,
} from "@prisma/client";
import { createAccessToken } from "../auth";

function between(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export const User = async ({ ...data }: Partial<UserType> = {}) => {
  return await prisma.user.create({
    data: {
      displayName: faker.name.firstName(),
      email: faker.internet.email(),
      admin: false,
      active: true,
      ...data,
    },
  });
};

export const Brand = async ({ ...data }: Partial<BrandType> = {}) => {
  return await prisma.brand.create({
    data: {
      name: faker.company.name(),
      country: faker.address.country(),
      public: true,
      ...data,
    },
  });
};

export const Distiller = async ({ ...data }: Partial<DistillerType> = {}) => {
  return await prisma.distiller.create({
    data: {
      name: faker.company.name(),
      country: faker.address.country(),
      public: true,
      ...data,
    },
  });
};

export const Bottle = async ({
  distillerIds = [],
  ...data
}: Partial<
  BottleType & {
    distillerIds: number[];
  }
> = {}) => {
  if (data.brandId === undefined) data.brandId = (await Brand()).id;

  const distillers: Prisma.DistillerCreateNestedManyWithoutBottlesInput = {};
  if (!distillerIds.length) {
    if (between(0, 1) === 1) {
      distillers.connect = [{ id: (await Distiller()).id }];
    }
  } else {
    distillers.connect = distillerIds.map((d) => ({ id: d }));
  }

  return await prisma.bottle.create({
    data: {
      name: faker.music.songName(),
      series: faker.music.songName(),
      ...data,
      distillers,
    },
  });
};

export const Checkin = async ({ ...data }: Partial<CheckinType> = {}) => {
  if (data.bottleId === undefined) data.bottleId = (await Bottle()).id;
  if (data.userId === undefined) data.userId = (await User()).id;

  return await prisma.checkin.create({
    data: {
      tastingNotes: faker.lorem.sentence(),
      rating: faker.datatype.float({ min: 1, max: 5 }),
      ...data,
    },
  });
};

export const AuthToken = async ({ user }: { user?: UserType | null } = {}) => {
  if (!user) user = await User();

  return createAccessToken(user);
};

export const AuthenticatedHeaders = async ({
  user,
}: {
  user?: UserType | null;
} = {}) => {
  return {
    Authorization: `Bearer ${await AuthToken({ user })}`,
  };
};
