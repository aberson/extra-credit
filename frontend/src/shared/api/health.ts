export const HEALTH_ROUTE = "/api/health" as const;

export interface HealthResponse {
  status: "ok";
  version: string;
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<HealthResponse>;
  return candidate.status === "ok" && typeof candidate.version === "string";
}
