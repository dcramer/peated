import type { RouteOptions } from 'fastify'
import { IncomingMessage, Server, ServerResponse } from 'http'

import { and, eq } from 'drizzle-orm'
import { OAuth2Client } from 'google-auth-library'
import config from '../config'
import { db } from '../db'
import { identities, users } from '../db/schema'
import { createAccessToken } from '../lib/auth'
import { serializeUser } from '../lib/transformers/user'

export default {
  method: 'POST',
  url: '/auth/google',
  schema: {
    body: {
      type: 'object',
      required: ['code'],
      properties: {
        code: { type: 'string' },
      },
    },
  },
  handler: async function (req, res) {
    const { code } = req.body

    // https://stackoverflow.com/questions/74132586/authentication-using-node-js-oauthclient-auth-code-flow
    const client = new OAuth2Client(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      'postmessage',
    )

    const { tokens } = await client.getToken(code)
    // client.setCredentials(tokens);

    if (!tokens.id_token) {
      return res.status(401).send({ error: 'Unable to validate credentials' })
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload || !payload.email) {
      return res.status(401).send({ error: 'Unable to validate credentials' })
    }

    const [result] = await db
      .select({
        user: users,
      })
      .from(users)
      .innerJoin(identities, eq(users.id, identities.userId))
      .where(
        and(
          eq(identities.provider, 'google'),
          eq(identities.externalId, payload.sub),
        ),
      )
    let user = result?.user

    // try to associate w/ existing user
    if (!user) {
      const [foundUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, payload.email))
      if (foundUser) {
        // TODO: handle race condition
        await db.insert(identities).values({
          provider: 'google',
          externalId: payload.sub,
          userId: foundUser.id,
        })
        user = foundUser

        // create new account
      } else {
        console.log('Creating new user')
        user = await db.transaction(async (tx) => {
          let [createdUser] = await tx
            .insert(users)
            .values({
              displayName: payload.given_name,
              email: payload.email!,
            })
            .returning()

          await tx.insert(identities).values({
            provider: 'google',
            externalId: payload.sub,
            userId: createdUser.id,
          })

          return createdUser
        })
      }
    }

    return res.send({
      user: serializeUser(user, user),
      accessToken: await createAccessToken(user),
    })
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: {
      code: string
    }
  }
>
