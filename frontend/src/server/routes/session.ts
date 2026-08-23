import type { FastifyPluginAsync } from "fastify";

export interface SessionRouteOptions {
  readonly token: string;
}

export interface SessionResponse {
  readonly token: string;
}

export const sessionRoutes: FastifyPluginAsync<SessionRouteOptions> = async (
  app,
  options,
) => {
  app.get<{ Reply: SessionResponse }>("/api/session", async () => ({
    token: options.token,
  }));
};
