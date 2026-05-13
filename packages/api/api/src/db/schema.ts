import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
  unique,
  primaryKey,
  inet,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  display_name: varchar("display_name", { length: 255 }).notNull(),
  password_hash: text("password_hash"),
  type: varchar("type", { length: 20 }).notNull().default("human"),
  bot_type: varchar("bot_type", { length: 50 }),
  bot_api_key: varchar("bot_api_key", { length: 255 }).unique(),
  bot_allowed_ip: inet("bot_allowed_ip"),
  status: varchar("status", { length: 20 }).notNull().default("offline"),
  last_seen_at: timestamp("last_seen_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const channels = pgTable("channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  display_name: varchar("display_name", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 20 }).notNull().default("public"),
  topic: varchar("topic", { length: 500 }),
  created_by: uuid("created_by").references(() => users.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archived_at: timestamp("archived_at", { withTimezone: true }),
});

export const channelMembers = pgTable(
  "channel_members",
  {
    channel_id: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("member"),
    joined_at: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.channel_id, table.user_id] }),
  })
);

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  channel_id: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  content_type: varchar("content_type", { length: 50 }).notNull().default("text"),
  parent_id: uuid("parent_id"),
  reply_count: integer("reply_count").notNull().default(0),
  file_ids: uuid("file_ids").array().notNull().default([]),
  mentions: jsonb("mentions").notNull().default([]),
  edited_at: timestamp("edited_at", { withTimezone: true }),
  is_pinned: boolean("is_pinned").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const driveFolders = pgTable("drive_folders", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  parent_id: uuid("parent_id"),
  owner_id: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  channel_id: uuid("channel_id").unique().references(() => channels.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
});

export const driveFiles = pgTable("drive_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  folder_id: uuid("folder_id").references(() => driveFolders.id),
  owner_id: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  mime_type: varchar("mime_type", { length: 255 }).notNull(),
  size_bytes: bigint("size_bytes", { mode: "number" }).notNull(),
  storage_path: text("storage_path").notNull(),
  version: integer("version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  channels: many(channels, { relationName: "channel_creator" }),
  channelMemberships: many(channelMembers),
  messages: many(messages),
  driveFolders: many(driveFolders, { relationName: "folder_owner" }),
  driveFiles: many(driveFiles, { relationName: "file_owner" }),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  creator: one(users, {
    fields: [channels.created_by],
    references: [users.id],
    relationName: "channel_creator",
  }),
  members: many(channelMembers),
  messages: many(messages),
  driveFolder: one(driveFolders, {
    fields: [channels.id],
    references: [driveFolders.channel_id],
  }),
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(channels, {
    fields: [channelMembers.channel_id],
    references: [channels.id],
  }),
  user: one(users, {
    fields: [channelMembers.user_id],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  channel: one(channels, {
    fields: [messages.channel_id],
    references: [channels.id],
  }),
  user: one(users, {
    fields: [messages.user_id],
    references: [users.id],
  }),
  parent: one(messages, {
    fields: [messages.parent_id],
    references: [messages.id],
  }),
}));

export const driveFoldersRelations = relations(driveFolders, ({ one, many }) => ({
  parent: one(driveFolders, {
    fields: [driveFolders.parent_id],
    references: [driveFolders.id],
  }),
  owner: one(users, {
    fields: [driveFolders.owner_id],
    references: [users.id],
    relationName: "folder_owner",
  }),
  channel: one(channels, {
    fields: [driveFolders.channel_id],
    references: [channels.id],
  }),
  files: many(driveFiles),
}));

export const driveFilesRelations = relations(driveFiles, ({ one }) => ({
  folder: one(driveFolders, {
    fields: [driveFiles.folder_id],
    references: [driveFolders.id],
  }),
  owner: one(users, {
    fields: [driveFiles.owner_id],
    references: [users.id],
    relationName: "file_owner",
  }),
}));
