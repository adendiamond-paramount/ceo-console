import { DurableObject } from "cloudflare:workers";

export class MessageRelay extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname === "/broadcast") {
      const data = await request.text();
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(data);
        } catch {
          ws.close(1011, "Send failed");
        }
      }
      return new Response("ok");
    }

    return new Response("not found", { status: 404 });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message === "ping") {
      ws.send("pong");
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    ws.close(code, reason);
  }

  webSocketError(ws: WebSocket, error: unknown) {
    ws.close(1011, "Unexpected error");
  }
}
