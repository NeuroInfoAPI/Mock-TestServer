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
};

export function errorPayload(code: ApiErrorCode): ApiErrorPayload {
  return {
    error: {
      code,
      message: MESSAGES[code],
    },
  };
}
