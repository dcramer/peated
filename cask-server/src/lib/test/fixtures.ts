import { faker } from "@faker-js/faker";
import { prisma } from "../db";
import {
  Bottle as BottleType,
  Bottler as BottlerType,
  Brand as BrandType,
  Producer as ProducerType,
  User as UserType,
} from "@prisma/client";

export const User = async ({ ...data }: Partial<UserType> = {}) => {
  return await prisma.user.create({
    data: {
      displayName: faker.name.firstName(),
      email: faker.internet.email(),
      ...data,
    },
  });
};

export const Brand = async ({ ...data }: Partial<BrandType> = {}) => {
  return await prisma.brand.create({
    data: {
      name: faker.company.name(),
      country: faker.address.country(),
      ...data,
    },
  });
};

export const Bottle = async ({ ...data }: Partial<BottleType> = {}) => {
  if (data.brandId === undefined) data.brandId = (await Brand()).id;

  return await prisma.bottle.create({
    data: {
      name: faker.music.songName(),
      series: faker.music.songName(),
      ...data,
    },
  });
};
