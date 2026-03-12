import { createRequestHandler } from "react-router";

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
    return requestHandler(request, {
      cloudflare: { env: env as Env & CloudflareSecrets, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
