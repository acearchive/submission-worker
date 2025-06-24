import { RouteHandler, Router, json } from "itty-router";
import { Artifact, Metadata } from "./model";
import { MethodNotAllowed, NotFound, ResponseError } from "./response";
import { validateAuth } from "./auth";
import { InsertArtifactQuery, UpdateMetadataQuery } from "./sql";

// Right now, artifact-submit-action is the only client which will be sending artifact metadata to
// this worker.
const expectedUser = "artifact-submit-action";

export interface Env {
  DB: D1Database;
  AUTH_PASS: string;
}

const router = Router();

router
  .all("*", (req, env) => {
    validateAuth(req, { user: expectedUser, pass: env.AUTH_PASS });
  })
  .all("/submit", async (req, env) => await submitArtifact(req, env))
  .all("/metadata", async (req, env) => await setMetadata(req, env))
  .all("*", () => {
    throw NotFound("No such endpoint");
  });

const submitArtifact: RouteHandler = async (req, env): Promise<Response> => {
  if (req.method !== "POST") {
    throw MethodNotAllowed("Unsupported HTTP method", ["POST"]);
  }

  console.log("Deserializing request body");

  const reqBody = await req.json<Artifact>();

  console.log(JSON.stringify(reqBody));

  await new InsertArtifactQuery(env.DB).run(reqBody);

  return new Response(undefined, {
    status: 201,
  });
};

const setMetadata: RouteHandler = async (req, env): Promise<Response> => {
  if (req.method !== "PUT") {
    throw MethodNotAllowed("Unsupported HTTP method", ["PUT"]);
  }

  console.log("Deserializing request body");

  const reqBody = await req.json<Metadata>();

  console.log(JSON.stringify(reqBody));

  await new UpdateMetadataQuery(env.DB).run(reqBody);

  return new Response(undefined, {
    status: 200,
  });
};

export default {
  fetch: (request: Request, env: Env) =>
    router.handle(request, env).catch((err) => {
      console.log(err.message);

      if (err instanceof ResponseError) {
        return json({ error: err.message, status: err.status }, { status: err.status, headers: err.headers });
      } else {
        return json({ error: err.message, status: 500 }, { status: 500 });
      }
    }),
};
