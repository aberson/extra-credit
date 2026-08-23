import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import {
  API_ORIGIN,
  LOOPBACK_HOST,
  WEB_PORT,
} from "./src/shared/runtime/ports.ts";

const frontendRoot = fileURLToPath(new URL(".", import.meta.url));
const webRoot = resolve(frontendRoot, "src/web");
const webOutDir = resolve(frontendRoot, "dist/web");
const repositoryConfigRoot = resolve(frontendRoot, "../config");
const viteAuthorityErrorCode = "EXTRA_CREDIT_VITE_AUTHORITY_ERROR";

// Setting fs.deny replaces Vite's defaults, so retain each documented sensitive
// pattern while explicitly denying the repository config directory as well.
const viteSensitiveFileDeny = [
  ".env",
  ".env.*",
  "*.{crt,pem,key,p12,pfx,cer,der}",
  ".npmrc",
  ".yarnrc.yml",
  "**/.git/**",
  "config/**",
  "**/config/**",
];

function enforceFixedDevelopmentAuthority(): Plugin {
  return {
    name: "extra-credit-fixed-development-authority",
    configResolved(config) {
      if (config.command !== "serve") {
        return;
      }

      if (
        config.server.host !== LOOPBACK_HOST ||
        config.server.port !== WEB_PORT ||
        config.server.strictPort !== true
      ) {
        throw new Error(
          `${viteAuthorityErrorCode}: The development listener must use the fixed loopback authority.`,
        );
      }
    },
  };
}

function denyRepositoryConfigRequests(): Plugin {
  return {
    name: "extra-credit-deny-repository-config",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestUrl = request.url;
        if (requestUrl === undefined || !requestUrl.startsWith("/@fs/")) {
          next();
          return;
        }

        try {
          const encodedPath = requestUrl.slice("/@fs/".length).split(/[?#]/u, 1)[0];
          const requestedPath = resolve(decodeURIComponent(encodedPath ?? ""));
          const isRepositoryConfig =
            requestedPath === repositoryConfigRoot ||
            requestedPath.startsWith(`${repositoryConfigRoot}${sep}`);

          if (!isRepositoryConfig) {
            next();
            return;
          }
        } catch {
          response.statusCode = 403;
          response.end("Forbidden");
          return;
        }

        response.statusCode = 403;
        response.end("Forbidden");
      });
    },
  };
}

export default defineConfig((configEnvironment) => {
  if (configEnvironment.isPreview === true) {
    throw new Error(
      `${viteAuthorityErrorCode}: Vite preview is disabled; use npm run start.`,
    );
  }

  return {
    root: webRoot,
    plugins: [
      enforceFixedDevelopmentAuthority(),
      denyRepositoryConfigRequests(),
      react(),
    ],
    build: {
      emptyOutDir: false,
      outDir: webOutDir,
    },
    server: {
      host: LOOPBACK_HOST,
      port: WEB_PORT,
      strictPort: true,
      fs: {
        strict: true,
        allow: [frontendRoot],
        deny: viteSensitiveFileDeny,
      },
      proxy: {
        "^/api/health(?:\\?.*)?$": {
          target: API_ORIGIN,
          changeOrigin: true,
        },
        "^/api/session(?:\\?.*)?$": {
          target: API_ORIGIN,
          changeOrigin: true,
        },
        "^/api/config(?:\\?.*)?$": {
          target: API_ORIGIN,
          changeOrigin: true,
        },
      },
    },
  };
});
