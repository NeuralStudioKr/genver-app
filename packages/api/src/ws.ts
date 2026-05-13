import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { verifyToken } from "./auth.js";
import { db, schema } from "./db/index.js";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

interface WSClient {
  ws: WebSocket;
  userId: string;
  userType: "human" | "bot" | "system";
  subscribedChannels: Set<string>;
}

const clients = new Map<string, WSClient>();

export function getOnlineUserIds(): string[] {
  return Array.from(clients.keys());
}

export function isUserOnline(userId: string): boolean {
  return clients.has(userId);
}

export function broadcastToChannel(
  channelId: string,
  message: object,
  excludeUserId?: string
): void {
  for (const [, client] of clients) {
    if (client.subscribedChannels.has(channelId)) {
      if (excludeUserId && client.userId === excludeUserId) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }
}

export function broadcastToAllBots(message: object): void {
  for (const [, client] of clients) {
    if (client.userType === "bot" && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
}

export function sendToUser(userId: string, message: object): void {
  const client = clients.get(userId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

async function authenticateWebSocket(
  ws: WebSocket,
  req: IncomingMessage
): Promise<{ userId: string; userType: "human" | "bot" | "system" } | null> {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    const botId = url.searchParams.get("bot_id");
    const apiKey = url.searchParams.get("api_key");

    if (botId && apiKey) {
      const user = await db.query.users.findFirst({
        where: and(eq(schema.users.id, botId), eq(schema.users.type, "bot")),
      });

      if (!user || !user.bot_api_key) return null;

      const valid = await bcrypt.compare(apiKey, user.bot_api_key);
      if (!valid) return null;

      return { userId: user.id, userType: "bot" };
    }

    if (token) {
      const decoded = verifyToken(token);
      return { userId: decoded.userId, userType: decoded.userType };
    }

    return null;
  } catch {
    return null;
  }
}

async function subscribeBotToPublicChannels(client: WSClient): Promise<void> {
  const publicChannels = await db.query.channels.findMany({
    where: eq(schema.channels.type, "public"),
  });
  for (const ch of publicChannels) {
    client.subscribedChannels.add(ch.id);
  }
}

function broadcastPresence(userId: string, status: string): void {
  for (const [, client] of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(
        JSON.stringify({
          type: "presence",
          userId,
          status,
        })
      );
    }
  }
}

export function setupWebSocket(server: import("http").Server): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const auth = await authenticateWebSocket(ws, req);
    if (!auth) {
      ws.close(4001, "Authentication failed");
      return;
    }

    const { userId, userType } = auth;

    const existing = clients.get(userId);
    if (existing) {
      existing.ws.close(4000, "New connection established");
    }

    const client: WSClient = {
      ws,
      userId,
      userType,
      subscribedChannels: new Set(),
    };

    clients.set(userId, client);

    await db
      .update(schema.users)
      .set({ status: "online", last_seen_at: new Date() })
      .where(eq(schema.users.id, userId));

    broadcastPresence(userId, "online");

    if (userType === "bot") {
      await subscribeBotToPublicChannels(client);
    }

    let isAlive = true;
    const pingInterval = setInterval(() => {
      if (!isAlive) {
        clearInterval(pingInterval);
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000);

    ws.on("pong", () => {
      isAlive = true;
    });

    ws.on("message", async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case "subscribe": {
            const channelId = msg.channelId as string;
            if (channelId) {
              client.subscribedChannels.add(channelId);
              ws.send(
                JSON.stringify({
                  type: "subscribed",
                  channelId,
                })
              );
            }
            break;
          }

          case "unsubscribe": {
            const channelId = msg.channelId as string;
            if (channelId) {
              client.subscribedChannels.delete(channelId);
              ws.send(
                JSON.stringify({
                  type: "unsubscribed",
                  channelId,
                })
              );
            }
            break;
          }

          case "typing": {
            const channelId = msg.channelId as string;
            if (channelId) {
              broadcastToChannel(
                channelId,
                {
                  type: "typing",
                  channelId,
                  userId,
                  displayName: msg.displayName || userId,
                },
                userId
              );
            }
            break;
          }

          case "ping": {
            ws.send(JSON.stringify({ type: "pong" }));
            break;
          }

          default:
            break;
        }
      } catch {
        return;
      }
    });

    ws.on("close", async () => {
      clearInterval(pingInterval);
      clients.delete(userId);

      await db
        .update(schema.users)
        .set({ status: "offline", last_seen_at: new Date() })
        .where(eq(schema.users.id, userId));

      broadcastPresence(userId, "offline");
    });

    ws.on("error", () => {
      clearInterval(pingInterval);
      clients.delete(userId);
    });

    ws.send(
      JSON.stringify({
        type: "connected",
        userId,
        userType,
      })
    );
  });

  return wss;
}
