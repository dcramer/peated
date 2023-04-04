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

export const Producer = async ({ ...data }: Partial<ProducerType> = {}) => {
  return await prisma.producer.create({
    data: {
      name: faker.company.name(),
      country: faker.address.country(),
      ...data,
    },
  });
};

export const Bottler = async ({ ...data }: Partial<BottlerType> = {}) => {
  return await prisma.bottler.create({
    data: {
      name: faker.company.name(),
      ...data,
    },
  });
};

export const Brand = async ({ ...data }: Partial<BrandType> = {}) => {
  return await prisma.brand.create({
    data: {
      name: faker.company.name(),
      ...data,
    },
  });
};

export const Bottle = async ({ ...data }: Partial<BottleType> = {}) => {
  if (data.producerId === undefined) data.producerId = (await Producer()).id;
  if (data.bottlerId === undefined) data.bottlerId = (await Bottler()).id;
  if (data.brandId === undefined) data.brandId = (await Brand()).id;

  return await prisma.bottle.create({
    data: {
      name: faker.music.songName(),
      ...data,
    },
  });
};
