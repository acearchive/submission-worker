import { badRequest, unauthorized } from "./response";

type AuthorizationResult =
  | {
      success: true;
      user: string;
      pass: string;
    }
  | {
      success: false;
      resp: Response;
    };

const getAuthorization = (req: Request): AuthorizationResult => {
  const authorization = req.headers.get("Authorization");

  if (authorization === null) {
    return {
      success: false,
      resp: unauthorized(),
    };
  }

  const [scheme, encoded] = authorization.split(" ");

  if (!encoded || scheme !== "Basic") {
    return {
      success: false,
      resp: badRequest("Malformed authorization header or unsupported authentication scheme"),
    };
  }

  const buffer = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  const decoded = new TextDecoder().decode(buffer).normalize();

  const index = decoded.indexOf(":");

  if (index === -1) {
    return {
      success: false,
      resp: badRequest("Invalid authorization value"),
    };
  }

  return {
    success: true,
    user: decoded.substring(0, index),
    pass: decoded.substring(index + 1),
  };
};

export type AuthenticationResult =
  | {
      success: true;
    }
  | {
      success: false;
      resp: Response;
    };

export const isAuthenticated = (req: Request, expectedUser: string, expectedPass: string): AuthenticationResult => {
  const result = getAuthorization(req);

  if (!result.success) {
    return {
      success: false,
      resp: result.resp,
    };
  }

  const { user, pass } = result;

  const actualCredentials = `${user}:${pass}`;
  const expectedCredentials = `${expectedUser}:${expectedPass}`;

  const encoder = new TextEncoder();

  const encodedActual = encoder.encode(actualCredentials);
  const encodedExpected = encoder.encode(expectedCredentials);

  if (encodedActual.byteLength != encodedExpected.byteLength) {
    return {
      success: false,
      resp: unauthorized(),
    };
  }

  const isEqual = crypto.subtle.timingSafeEqual(encodedActual, encodedExpected);

  if (!isEqual) {
    return {
      success: false,
      resp: unauthorized(),
    };
  }

  return { success: true };
};
