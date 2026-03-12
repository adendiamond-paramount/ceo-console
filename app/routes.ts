import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/messages", "routes/api.messages.ts"),
] satisfies RouteConfig;
