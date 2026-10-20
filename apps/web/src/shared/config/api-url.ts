const DEFAULT_API_URL = "http://localhost:4000";

export function getApiUrl(): string {
  return process.env["API_URL"] ?? DEFAULT_API_URL;
}
