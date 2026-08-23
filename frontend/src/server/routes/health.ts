import type { FastifyPluginAsync } from "fastify";

import {
  HEALTH_ROUTE,
  type HealthResponse,
} from "../../shared/api/health.js";

export interface HealthRouteOptions {
  version: string;
}

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (
  app,
  options,
) => {
  app.get<{ Reply: HealthResponse }>(HEALTH_ROUTE, async () => {
    return {
      status: "ok",
      version: options.version,
    };
  });
};
