import { OAuth2Namespace } from '@fastify/oauth2'
import 'fastify'

declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test'
    PORT?: string
    HOST?: string
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    googleOAuth2: OAuth2Namespace
  }
  export interface FastifyRequest {
    user: any
  }
}

interface CustomMatchers<R = unknown> {
  toRespondWith(statusCode: number): R
}

declare global {
  namespace Vi {
    interface Assertion extends CustomMatchers {}
    interface AsymmetricMatchersContaining extends CustomMatchers {}
  }

  const DefaultFixtures = {
    user: User,
    authHeaders: {
      Authorization: string,
    },
  }
}
