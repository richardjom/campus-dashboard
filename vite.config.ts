import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { handlePlanningCenterRequest } from "./server/planning-center-http";

const allowedSandboxHosts = [".vercel.run", ".vercel.app"];

function planningCenterProxyPlugin(): Plugin {
  const attachMiddleware = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/api/planning-center/")) {
        next();
        return;
      }

      await handlePlanningCenterRequest(req, res);
    });
  };

  return {
    name: "planning-center-proxy",
    configureServer(server) {
      attachMiddleware(server);
    },
    configurePreviewServer(server) {
      attachMiddleware(server);
    },
  };
}

export default defineConfig({
  plugins: [react(), planningCenterProxyPlugin()],
  server: {
    host: "0.0.0.0",
    allowedHosts: allowedSandboxHosts,
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: allowedSandboxHosts,
  },
});
