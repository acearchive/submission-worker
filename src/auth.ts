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
    console.log("Missing encoded credential after auth scheme");
    throw Unauthorized("Malformed authorization header");
  }

  if (scheme !== "Basic") {
    console.log(`Header contains ${scheme} auth scheme`);
    throw Unauthorized("Unsupported authorization scheme");
  }

  const buffer = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  const decoded = new TextDecoder().decode(buffer).normalize();

  const index = decoded.indexOf(":");

  if (index === -1) {
    console.log("Decoded credential missing colon separator");
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

  console.log("Retrieved credentials from auth header");

  const actualCredentials = `${user}:${pass}`;
  const expectedCredentials = `${auth.user}:${auth.pass}`;

  const encoder = new TextEncoder();

  const encodedActual = encoder.encode(actualCredentials);
  const encodedExpected = encoder.encode(expectedCredentials);

  if (encodedActual.byteLength != encodedExpected.byteLength) {
    console.log("Expected vs actual credentials are different lengths");
    throw Unauthorized("Invalid credentials");
  }

  if (!crypto.subtle.timingSafeEqual(encodedActual, encodedExpected)) {
    console.log("Expected vs actual credentials are the same length but not equal");
    throw Unauthorized("Invalid credentials");
  }
};
