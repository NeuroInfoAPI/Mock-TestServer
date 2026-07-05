import { errorPayload } from "./errors";

const AUTH_ERROR_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export interface AuthResult {
  ok: boolean;
  token?: string;
  response?: Response;
}

export function extractBearerToken(request: Request): string | null {
  const raw = request.headers.get("authorization");
  if (!raw || !raw.startsWith("Bearer ")) return null;
  const token = raw.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function requireAuthHeader(request: Request): AuthResult {
  const token = extractBearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: Response.json(errorPayload("AU1"), { status: 401, headers: AUTH_ERROR_HEADERS }),
    };
  }

  return {
    ok: true,
    token,
  };
}

export function isUnlimitedToken(token: string): boolean {
  return token.startsWith("unltd_");
}
