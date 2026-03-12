import { createRequestHandler } from "react-router";

export { MessageRelay } from "./message-relay";

interface CloudflareSecrets {
  SLACK_SIGNING_SECRET: string;
  SLACK_BOT_TOKEN: string;
  DISCORD_WEBHOOK_URL: string;
}

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env & CloudflareSecrets;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      const id = env.MESSAGE_RELAY.idFromName("global");
      const stub = env.MESSAGE_RELAY.get(id);
      return stub.fetch(request);
    }

    return requestHandler(request, {
      cloudflare: { env: env as Env & CloudflareSecrets, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
