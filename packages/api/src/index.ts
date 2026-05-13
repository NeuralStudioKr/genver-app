import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import bcrypt from "bcryptjs";
import { db, schema } from "./db/index.js";
import { eq } from "drizzle-orm";
import { setupWebSocket } from "./ws.js";
import { runMigrations } from "./db/migrate.js";
import authRoutes from "./routes/auth.js";
import channelRoutes from "./routes/channels.js";
import messageRoutes from "./routes/messages.js";
import driveRoutes from "./routes/drive.js";
import botRoutes from "./routes/bots.js";
import userRoutes from "./routes/users.js";

const PORT = parseInt(process.env.PORT || "4000", 10);

async function seedDefaults() {
  const existingUsers = await db.query.users.findMany({ limit: 1 });
  if (existingUsers.length > 0) return;

  const adminHash = await bcrypt.hash("admin123", 10);
  const [admin] = await db
    .insert(schema.users)
    .values({
      email: "admin@genver.local",
      display_name: "Admin",
      password_hash: adminHash,
      type: "human",
      status: "offline",
    })
    .returning();

  const botReviewerKey = "genv_sk_bot1_reviewer_key_32bytes!";
  const botDeployerKey = "genv_sk_bot2_deployer_key_32bytes!";

  const botReviewerHash = await bcrypt.hash(botReviewerKey, 10);
  const botDeployerHash = await bcrypt.hash(botDeployerKey, 10);

  await db.insert(schema.users).values([
    {
      email: "bot-reviewer@genver.local",
      display_name: "Bot Reviewer",
      password_hash: botReviewerHash,
      type: "bot",
      bot_type: "openclaw",
      bot_api_key: botReviewerHash,
      status: "offline",
    },
    {
      email: "bot-deployer@genver.local",
      display_name: "Bot Deployer",
      password_hash: botDeployerHash,
      type: "bot",
      bot_type: "openclaw",
      bot_api_key: botDeployerHash,
      status: "offline",
    },
  ]);

  const [generalChannel] = await db
    .insert(schema.channels)
    .values({
      name: "general",
      display_name: "General",
      description: "Default public channel for everyone",
      type: "public",
      created_by: admin.id,
    })
    .returning();

  await db.insert(schema.channelMembers).values({
    channel_id: generalChannel.id,
    user_id: admin.id,
    role: "admin",
  });

  console.log("Default admin user, bots, and general channel created");
}

async function main() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true,
    })
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api", authRoutes);
  app.use("/api", channelRoutes);
  app.use("/api", messageRoutes);
  app.use("/api", driveRoutes);
  app.use("/api", botRoutes);
  app.use("/api", userRoutes);

  const server = http.createServer(app);
  setupWebSocket(server);

  const dbUrl = process.env.DATABASE_URL || "postgres://genver:genverpass@localhost:5432/genver";
  await runMigrations(dbUrl);
  await seedDefaults();

  server.listen(PORT, () => {
    console.log(`Genver API server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
