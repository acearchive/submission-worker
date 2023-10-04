import { RouteHandler, Router, error } from "itty-router";
import { Artifact } from "./model";
import { endpointNotFound, methodNotAllowed, created } from "./response";
import { isAuthenticated } from "./auth";
import { insertArtifact } from "./sql";

const expectedUser = "user";

export interface Env {
  DB: D1Database;
  AUTH_PASS: string;
}

const router = Router();

router
  .all("*", (req, env) => {
    const authResult = isAuthenticated(req, expectedUser, env.AUTH_PASS);

    if (!authResult.success) return authResult.resp;
  })
  .all("/submit", async (resp, env) => await submit(resp, env))
  .all("*", () => endpointNotFound());

const submit: RouteHandler = async (req, env): Promise<Response> => {
  if (req.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const reqBody = await req.json<Artifact>();

  await insertArtifact(env.DB, reqBody);

  return created();
};

export default {
  fetch: (request: Request, env: Env) => router.handle(request, env).catch(error),
};
