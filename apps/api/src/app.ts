// make sure to import this _before_ all other code
import "./sentry";

import fastifyAutoload from "@fastify/autoload";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyMultipart from "@fastify/multipart";
import fastifyRequestContext from "@fastify/request-context";
import fastifySwagger from "@fastify/swagger";
import { fastify } from "fastify";
import fastifyHttpErrorsEnhanced from "fastify-http-errors-enhanced";
import {
  fastifyZodOpenApiPlugin,
  fastifyZodOpenApiTransform,
  fastifyZodOpenApiTransformObject,
  RequestValidationError,
  serializerCompiler,
  validatorCompiler,
} from "fastify-zod-openapi";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import type { ZodOpenApiVersion } from "zod-openapi";
import config from "./config";
import { MAX_FILESIZE } from "./constants";
import type { User } from "./db/schema";
import { injectAuth } from "./middleware/auth";
import authRoute from "./routes/auth";
import fastifySentry from "./sentryPlugin";
import { gracefulShutdown } from "./worker/client";

declare module "@fastify/request-context" {
  interface RequestContextData {
    user: User | null;
  }
}

const envToLogger: {
  [env: string]: any;
} = {
  development: {
    level: "info",
    transport: {
      target: "@fastify/one-line-logger",
    },
  },
  production: {
    level: "warn",
  },
  test: {
    level: "error",
    transport: {
      target: "@fastify/one-line-logger",
    },
  },
};

const __dirname = import.meta.dirname;

export default async function buildFastify(options = {}) {
  const app = fastify({
    logger: envToLogger[config.ENV] ?? true,
    maxParamLength: 5000,
    trustProxy: true,
    ajv: {
      customOptions: {
        allErrors: process.env.NODE_ENV === "test",
      },
    },
    ...options,
  });

  app.addHook("preHandler", (request, reply, done) => {
    // default cache headers
    reply.headers({
      "Cache-Control":
        "private, no-cache, no-store, max-age=0, must-revalidate",
    });
    done();
  });

  app.addHook("onClose", async () => {
    await gracefulShutdown();
  });

  app.addHook("onRequest", injectAuth);

  if (config.ENV === "development") {
    console.log("Adding 300ms delay to all requests");
    app.addHook("onRequest", async (request, reply) => {
      await setTimeout(300);
    });
  }

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(fastifySentry);
  await app.register(fastifyHttpErrorsEnhanced);
  await app.register(fastifyZodOpenApiPlugin);
  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.0.3" satisfies ZodOpenApiVersion,
      info: {
        title: "Peated API",
        description: "Peated is an Open API for whisky enthusiasts.",
        version: "0.1.0",
      },
      // servers: [
      //   {
      //     url: "http://localhost:3000",
      //     description: "Development server",
      //   },
      // ],
      // tags: [
      //   { name: "user", description: "User related end-points" },
      //   { name: "code", description: "Code related end-points" },
      // ],
      // components: {
      //   securitySchemes: {
      //     apiKey: {
      //       type: "apiKey",
      //       name: "apiKey",
      //       in: "header",
      //     },
      //   },
      // },
      // externalDocs: {
      //   url: "https://swagger.io",
      //   description: "Find more info here",
      // },
    },
    transform: fastifyZodOpenApiTransform,
    transformObject: fastifyZodOpenApiTransformObject,
  });

  await app.register(fastifyMultipart, {
    limits: {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 100, // Max field value size in bytes
      fields: 10,
      fileSize: MAX_FILESIZE,
      files: 1, // Max number of file fields
      headerPairs: 2000, // Max number of header key=>value pairs
    },
  });

  await app.register(fastifyHelmet, {
    crossOriginResourcePolicy: {
      policy: "same-site",
    },
    contentSecurityPolicy: false,
  });

  await app.register(fastifyCors, {
    credentials: true,
    origin: config.CORS_HOST.split(","),
    maxAge: 600,
  });

  await app.register(fastifyRequestContext, {
    hook: "preValidation",
    defaultStoreValues: {
      user: null,
    },
  });

  // app.setErrorHandler(function (error, request, reply) {
  //   const { validation, validationContext } = error;

  //   if (validation) {
  //     reply.status(error.statusCode || 500).send({
  //       ok: false,
  //       name: "validation",
  //       // validationContext will be 'body' or 'params' or 'headers' or 'query'
  //       message: `A validation error occurred when validating the ${validationContext}...`,
  //       // this is the result of your validation library...
  //       errors: validation,
  //     });
  //     // } else if (error instanceof errorCodes.FST_ERR_BAD_STATUS_CODE) {
  //     //   // Log error
  //     //   this.log.error(error);
  //     //   // Send error response
  //     //   reply.status(error.statusCode || 500).send({
  //     //     ok: false,
  //     //     stack: config.ENV !== "production" ? error.stack : undefined,
  //     //   });
  //   } else {
  //     console.error(error);
  //     // fastify will use parent error handler to handle this
  //     reply.status(error.statusCode || 500).send({
  //       ok: false,
  //       error: "Internal Server Error",
  //       stack: config.ENV !== "production" ? error.stack : undefined,
  //     });
  //   }
  // });

  await app.register(authRoute, { prefix: "/v1/auth" });

  // await app.register(fastifyAutoload, {
  //   dir: path.join(__dirname, "routes"),
  //   dirNameRoutePrefix: true,
  //   options: { prefix: "/v1/" },
  //   forceESM: true,
  //   // encapsulate: fase,
  // });

  return app;
}
