import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/messages", "routes/api.messages.ts"),
  route("slack/events", "routes/slack.events.ts"),
  route("slack/post", "routes/slack.post.ts"),
  route("post/:messageId/:replyIndex", "routes/post.$messageId.$replyIndex.tsx"),
  route("api/post/:messageId/:replyIndex", "routes/api.post.$messageId.$replyIndex.ts"),
  route("api/delete/:messageId", "routes/api.delete.$messageId.ts"),
] satisfies RouteConfig;
