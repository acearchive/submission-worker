import { BadRequest, Unauthorized } from "./response";

export interface Authorization {
  user: string;
  pass: string;
}

const getAuth = (req: Request): Authorization => {
  const authorization = req.headers.get("Authorization");

  if (authorization === null) {
    throw Unauthorized("Missing authorization header");
  }

  const [scheme, encoded] = authorization.split(" ");

  if (!encoded) {
    throw Unauthorized("Malformed authorization header");
  }

  if (scheme !== "Basic") {
    throw Unauthorized("Unsupported authorization scheme");
  }

  const buffer = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  const decoded = new TextDecoder().decode(buffer).normalize();

  const index = decoded.indexOf(":");

  if (index === -1) {
    throw Unauthorized("Malformed authorization header");
  }

  return {
    user: decoded.substring(0, index),
    pass: decoded.substring(index + 1),
  };
};

export const validateAuth = (req: Request, auth: Authorization) => {
  const { protocol, hostname } = new URL(req.url);

  if (protocol !== "https:" && hostname !== "localhost") {
    throw BadRequest("You must use an HTTPS connection");
  }

  const { user, pass } = getAuth(req);

  const actualCredentials = `${user}:${pass}`;
  const expectedCredentials = `${auth.user}:${auth.pass}`;

  const encoder = new TextEncoder();

  const encodedActual = encoder.encode(actualCredentials);
  const encodedExpected = encoder.encode(expectedCredentials);

  if (encodedActual.byteLength != encodedExpected.byteLength) {
    throw Unauthorized("Invalid credentials");
  }

  if (!crypto.subtle.timingSafeEqual(encodedActual, encodedExpected)) {
    throw Unauthorized("Invalid credentials");
  }
};
