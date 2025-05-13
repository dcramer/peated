// make sure to import this _before_ all other code
import "./sentry";

import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyMultipart from "@fastify/multipart";
import fastifyRequestContext from "@fastify/request-context";
import fastifySwagger from "@fastify/swagger";
import ScalarApiReference from "@scalar/fastify-api-reference";
import { fastify } from "fastify";
import fastifyHttpErrorsEnhanced from "fastify-http-errors-enhanced";
import {
  fastifyZodOpenApiPlugin,
  fastifyZodOpenApiTransform,
  fastifyZodOpenApiTransformObject,
  RequestValidationError,
  ResponseSerializationError,
  serializerCompiler,
  validatorCompiler,
} from "fastify-zod-openapi";
import {
  badRequestSchema,
  conflictSchema,
  forbiddenSchema,
  identifierByCodes,
  internalServerErrorSchema,
  isHttpError,
  messagesByCodes,
  notFoundSchema,
  phrasesByCodes,
  unauthorizedSchema,
} from "http-errors-enhanced";
import { setTimeout } from "node:timers/promises";
import type { ZodOpenApiVersion } from "zod-openapi";
import "zod-openapi/extend";
import config from "./config";
import { MAX_FILESIZE } from "./constants";
import type { User } from "./db/schema";
import { logError } from "./lib/log";
import { injectAuth } from "./middleware/auth";
import authLoginRoute from "./routes/authLogin";
import authMeRoute from "./routes/authMe";
import authPasswordResetRoute from "./routes/authPasswordReset";
import authRegisterRoute from "./routes/authRegister";
import rootRoute from "./routes/root";
import fastifySentry from "./sentryPlugin";
import { gracefulShutdown } from "./worker/client";

declare module "@fastify/request-context" {
  interface RequestContextData {
    user: User | null;
  }
}

type ErrorResponse = {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  stack?: string[];
};

const ROBOTS = `User-agent: *
Disallow: /`;

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

const processRoot = process.cwd();

const __dirname = import.meta.dirname;

export async function buildFastify(options = {}) {
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

  await app.register(fastifySentry);
  await app.register(fastifyHttpErrorsEnhanced);
  await app.register(fastifyZodOpenApiPlugin);
  await app.register(fastifySwagger, {
    hideUntagged: true,
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

  app.setErrorHandler(function (error, request, reply) {
    // const { validation, validationContext } = error;

    // if (error.validation) {
    //   const zodValidationErrors = error.validation.filter(
    //     (err) => err instanceof RequestValidationError,
    //   );
    //   const zodIssues = zodValidationErrors.map((err) => err.params.issue);
    //   const originalError = zodValidationErrors?.[0]?.params.error;
    //   return reply.status(422).send({
    //     zodIssues,
    //     originalError,
    //   });
    // }

    // if (validation) {
    //   reply.status(error.statusCode || 500).send({
    //     error: "Bad Request",
    //     // validationContext will be 'body' or 'params' or 'headers' or 'query'
    //     message: `A validation error occurred when validating the ${validationContext}...`,
    //     // this is the result of your validation library...
    //     errors: validation,
    //   } satisfies ErrorResponse);
    //   // } else if (error instanceof errorCodes.FST_ERR_BAD_STATUS_CODE) {
    //   //   // Log error
    //   //   this.log.error(error);
    //   //   // Send error response
    //   //   reply.status(error.statusCode || 500).send({
    //   //     ok: false,
    //   //     stack: config.ENV !== "production" ? error.stack : undefined,
    //   //   });
    // }

    if (isHttpError(error)) {
      return reply.status(error.statusCode).send({
        message: error.message.length
          ? error.message
          : messagesByCodes[error.statusCode],
        error: messagesByCodes[error.statusCode],
        statusCode: error.statusCode,
        code: messagesByCodes[error.statusCode],
      } satisfies ErrorResponse);
    } else if (error.statusCode) {
      console.log();
      return reply.status(error.statusCode).send({
        message: error.message.length
          ? error.message
          : phrasesByCodes[error.statusCode],
        error: messagesByCodes[error.statusCode],
        statusCode: error.statusCode,
        code: messagesByCodes[error.statusCode],
      } satisfies ErrorResponse);
    }

    logError(error);
    reply.status(500).send({
      message: phrasesByCodes[500],
      error: messagesByCodes[500],
      statusCode: 500,
      stack:
        process.env.NODE_ENV !== "production" && error.stack
          ? error.stack
              .split("\n")
              .slice(1)
              .map((s) =>
                s.trim().replace(/^at /, "").replace(processRoot, "$ROOT"),
              )
          : undefined,
    } satisfies ErrorResponse);
  });

  // TODO: per the docs we should be able to actually use Zod schemas directly
  // in the schema definitions, but that appears to be a lie. They still
  // require jsonschema
  // https://github.com/samchungy/fastify-zod-openapi
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // ALL ROUTES SHOULD BE DEFINED BELOW THIS

  app.route({
    method: "GET",
    url: "/_health",
    handler: (_, res) => {
      res.status(200).send();
    },
  });

  app.route({
    method: "GET",
    url: "/robots.txt",
    handler: (_, res) => {
      res.status(200).type("text/plain").send(ROBOTS);
    },
  });

  // unversioned routes

  await app.register(rootRoute);
  // await app.register(updateBadgeImage);
  // await app.register(updateBottleImage);
  // await app.register(updateTastingImage);
  // await app.register(updateUserAvatar);
  // await app.register(uploads);

  // Add error schemas
  // TODO: we seem to be able to use $ref - child routes registered
  // as plugins don't seem to be able to use $ref
  // app.addSchema(badRequestSchema);
  // app.addSchema(unauthorizedSchema);
  // app.addSchema(forbiddenSchema);
  // app.addSchema(notFoundSchema);
  // app.addSchema(conflictSchema);
  // app.addSchema(internalServerErrorSchema);

  // API v1 routes
  app.get("/v1/openapi.json", async (request, reply) => {
    return reply.send(app.swagger());
  });
  await app.register(rootRoute, { prefix: "/v1" });
  await app.register(authLoginRoute, { prefix: "/v1" });
  await app.register(authMeRoute, { prefix: "/v1" });
  await app.register(authPasswordResetRoute, { prefix: "/v1" });
  await app.register(authRegisterRoute, { prefix: "/v1" });

  // await app.register(fastifyAutoload, {
  //   dir: path.join(__dirname, "routes"),
  //   dirNameRoutePrefix: true,
  //   options: { prefix: "/v1/" },
  //   forceESM: true,
  //   // encapsulate: fase,
  // });

  await app.register(ScalarApiReference, {
    routePrefix: "/reference",
    // Additional hooks for the API reference routes. You can provide the onRequest and preHandler hooks
    hooks: {
      onRequest: function (request, reply, done) {
        done();
      },
      preHandler: function (request, reply, done) {
        done();
      },
    },
  });

  await app.ready();

  return app;
}

export default await buildFastify();
