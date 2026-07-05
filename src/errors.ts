import { ApiErrorCode, ApiErrorPayload } from "./contracts";

const MESSAGES: Record<ApiErrorCode, string> = {
  AP1: "Internal server error",
  AP3: "404 Not Found",
  SC1: "No schedule found in the database for the given week & year.",
  SC2: "Invalid year or week parameter",
  SC3: "Missing search query parameter",
  SC4: "Search query must be at least 3 characters long",
  VD1: "No vod found with the given stream id.",
  VD2: "No vods found in the database.",
  SB1: "No active subathon found",
  SB2: "Year parameter is required",
  SB3: "Invalid year parameter or year cannot be in the future",
  SB4: "No subathon found for the specified year",
  AU1: "Missing or invalid authorization header",
  AU2: "Invalid or expired API token",
  RL2: "Too many requests from this API token",
  RL3: "Rate limit exceeded: Maximum 30 requests per minute",
  RL4: "Rate limit exceeded: Maximum 100 requests per minute",
  RL5: "Rate limit exceeded: Maximum 300 requests per minute",
  RL6: "Rate limit exceeded: Maximum 10 requests per 10 seconds",
  RL7: "Rate limit exceeded: Maximum 2 requests per 10 seconds",
  RL8: "Rate limit exceeded: Maximum 6 requests per minute",
};

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && value in MESSAGES;
}

export function errorPayload(code: ApiErrorCode, path = "/api/v2"): ApiErrorPayload {
  return {
    error: {
      code,
      message: MESSAGES[code],
      timestamp: Date.now(),
      path,
    },
  };
}
