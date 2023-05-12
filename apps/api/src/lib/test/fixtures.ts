import { faker } from '@faker-js/faker'
import { db } from '../../db'
import {
  NewBottle,
  NewEntity,
  NewTasting,
  NewUser,
  User as UserType,
  bottles,
  bottlesToDistillers,
  entities,
  tastings,
  users,
} from '../../db/schema'
import { createAccessToken } from '../auth'

function between(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

export const User = async ({ ...data }: Partial<NewUser> = {}) => {
  return (
    await db
      .insert(users)
      .values({
        displayName: faker.name.firstName(),
        email: faker.internet.email(),
        admin: false,
        active: true,
        ...data,
      })
      .returning()
  )[0]
}

export const Entity = async ({ ...data }: Partial<NewEntity> = {}) => {
  return (
    await db
      .insert(entities)
      .values({
        name: faker.company.name(),
        country: faker.address.country(),
        type: ['brand', 'distiller'],
        ...data,
        createdById: data.createdById || (await User()).id,
      })
      .returning()
  )[0]
}

export const Bottle = async ({
  distillerIds = [],
  ...data
}: Partial<NewBottle> & {
  distillerIds?: number[]
} = {}) => {
  const [bottle] = await db
    .insert(bottles)
    .values({
      name: faker.music.songName(),
      ...data,
      brandId: data.brandId || (await Entity()).id,
      createdById: data.createdById || (await User()).id,
    })
    .returning()

  if (!distillerIds.length) {
    if (between(0, 1) === 1) {
      await db.insert(bottlesToDistillers).values({
        bottleId: bottle.id,
        distillerId: (await Entity({ type: ['distiller'] })).id,
      })
    }
  } else {
    for (const d of distillerIds) {
      await db.insert(bottlesToDistillers).values({
        bottleId: bottle.id,
        distillerId: d,
      })
    }
  }

  return bottle
}

export const Tasting = async ({ ...data }: Partial<NewTasting> = {}) => {
  return (
    await db
      .insert(tastings)
      .values({
        comments: faker.lorem.sentence(),
        rating: faker.datatype.float({ min: 1, max: 5 }),
        ...data,
        bottleId: data.bottleId || (await Bottle()).id,
        createdById: data.createdById || (await User()).id,
      })
      .returning()
  )[0]
}

export const AuthToken = async ({ user }: { user?: UserType | null } = {}) => {
  if (!user) user = await User()

  return createAccessToken(user)
}

export const AuthenticatedHeaders = async ({
  user,
}: {
  user?: UserType | null
} = {}) => {
  return {
    Authorization: `Bearer ${await AuthToken({ user })}`,
  }
}
