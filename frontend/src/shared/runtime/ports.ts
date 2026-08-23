export const LOOPBACK_HOST = "127.0.0.1" as const;

export const RUNTIME_PORTS = {
  api: 4310,
  web: 4311,
} as const;

export const API_PORT = RUNTIME_PORTS.api;
export const WEB_PORT = RUNTIME_PORTS.web;

export const API_ORIGIN = `http://${LOOPBACK_HOST}:${API_PORT}` as const;
export const WEB_ORIGIN = `http://${LOOPBACK_HOST}:${WEB_PORT}` as const;
