import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { eq, and, or, lt, desc, sql } from "drizzle-orm";
import { authMiddleware } from "../auth.js";
import { broadcastToChannel, broadcastToAllBots } from "../ws.js";

const router = Router();

router.use(authMiddleware);

router.get("/channels/:id/messages", async (req: Request, res: Response) => {
  try {
    const channelId = req.params.id;
    const before = req.query.before as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const conditions = [eq(schema.messages.channel_id, channelId)];

    if (before) {
      conditions.push(lt(schema.messages.created_at, new Date(before)));
    }

    const msgs = await db.query.messages.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.messages.created_at)],
      limit,
      with: {
        user: {
          columns: {
            id: true,
            display_name: true,
            type: true,
          },
        },
      },
    });

    const messages = msgs.reverse().map((msg) => ({
      id: msg.id,
      channelId: msg.channel_id,
      userId: msg.user_id,
      content: msg.content,
      contentType: msg.content_type,
      parentId: msg.parent_id,
      replyCount: msg.reply_count,
      fileIds: msg.file_ids,
      mentions: msg.mentions,
      editedAt: msg.edited_at,
      isPinned: msg.is_pinned,
      createdAt: msg.created_at,
      sender: msg.user
        ? {
            id: msg.user.id,
            displayName: msg.user.display_name,
            senderType: msg.user.type,
          }
        : null,
    }));

    res.json({ messages });
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/channels/:id/messages", async (req: Request, res: Response) => {
  try {
    const channelId = req.params.id;
    const { content, contentType, parentId, mentions, fileIds } = req.body;

    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const allUsers = await db.query.users.findMany({
      columns: { id: true, display_name: true },
      where: or(eq(schema.users.type, "bot"), eq(schema.users.type, "human")),
    });
    const parsedMentionIds: string[] = [];
    for (const u of allUsers) {
      if (content.includes(`@${u.display_name}`)) {
        if (!parsedMentionIds.includes(u.id)) {
          parsedMentionIds.push(u.id);
        }
      }
    }
    const finalMentions = [
      ...new Set([...(Array.isArray(mentions) ? mentions : []), ...parsedMentionIds]),
    ];

    const [message] = await db
      .insert(schema.messages)
      .values({
        channel_id: channelId,
        user_id: req.userId!,
        content,
        content_type: contentType || "text",
        parent_id: parentId || null,
        mentions: finalMentions,
        file_ids: fileIds || [],
      })
      .returning();

    if (parentId) {
      await db
        .update(schema.messages)
        .set({ reply_count: sql`${schema.messages.reply_count} + 1` })
        .where(eq(schema.messages.id, parentId));
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
      columns: {
        id: true,
        display_name: true,
        type: true,
      },
    });

    const messagePayload = {
      type: "message",
      id: message.id,
      channelId: message.channel_id,
      userId: message.user_id,
      content: message.content,
      contentType: message.content_type,
      parentId: message.parent_id,
      replyCount: message.reply_count,
      fileIds: message.file_ids,
      mentions: message.mentions,
      editedAt: message.edited_at,
      isPinned: message.is_pinned,
      createdAt: message.created_at,
      sender: user
        ? {
            id: user.id,
            displayName: user.display_name,
            senderType: user.type,
          }
        : null,
    };

    broadcastToChannel(channelId, messagePayload);

    res.status(201).json({ message: messagePayload });
  } catch (err) {
    console.error("Create message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/messages/:id", async (req: Request, res: Response) => {
  try {
    const msg = await db.query.messages.findFirst({
      where: eq(schema.messages.id, req.params.id),
    });

    if (!msg) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    if (msg.user_id !== req.userId) {
      res.status(403).json({ error: "Cannot delete another user's message" });
      return;
    }

    await db.delete(schema.messages).where(eq(schema.messages.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    console.error("Delete message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/messages/:id/reactions", async (req: Request, res: Response) => {
  try {
    const { emoji } = req.body;

    if (!emoji) {
      res.status(400).json({ error: "emoji is required" });
      return;
    }

    const msg = await db.query.messages.findFirst({
      where: eq(schema.messages.id, req.params.id),
    });

    if (!msg) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    const mentions = (msg.mentions as Record<string, unknown>[]) || [];
    const reactions = (mentions.find((m) => m.type === "reactions") as
      | { type: string; reactions: Record<string, string[]> }
      | undefined) || { type: "reactions", reactions: {} };

    if (!reactions.reactions) {
      reactions.reactions = {};
    }

    if (!reactions.reactions[emoji]) {
      reactions.reactions[emoji] = [];
    }

    if (!reactions.reactions[emoji].includes(req.userId!)) {
      reactions.reactions[emoji].push(req.userId!);
    }

    const updatedMentions = mentions.filter((m) => m.type !== "reactions");
    updatedMentions.push(reactions as unknown as Record<string, unknown>);

    await db
      .update(schema.messages)
      .set({ mentions: updatedMentions })
      .where(eq(schema.messages.id, req.params.id));

    res.json({ reactions: reactions.reactions });
  } catch (err) {
    console.error("Add reaction error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete(
  "/messages/:id/reactions/:emoji",
  async (req: Request, res: Response) => {
    try {
      const msg = await db.query.messages.findFirst({
        where: eq(schema.messages.id, req.params.id),
      });

      if (!msg) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      const mentions = (msg.mentions as Record<string, unknown>[]) || [];
      const reactions = (mentions.find((m) => m.type === "reactions") as
        | { type: string; reactions: Record<string, string[]> }
        | undefined);

      if (reactions?.reactions?.[req.params.emoji]) {
        reactions.reactions[req.params.emoji] = reactions.reactions[
          req.params.emoji
        ].filter((uid) => uid !== req.userId);
      }

      const updatedMentions = mentions.filter((m) => m.type !== "reactions");
      if (reactions) {
        updatedMentions.push(reactions as unknown as Record<string, unknown>);
      }

      await db
        .update(schema.messages)
        .set({ mentions: updatedMentions })
        .where(eq(schema.messages.id, req.params.id));

      res.json({ reactions: reactions?.reactions || {} });
    } catch (err) {
      console.error("Remove reaction error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
