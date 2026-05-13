import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, schema } from "../db/index.js";
import { eq, and, isNull } from "drizzle-orm";
import { authMiddleware } from "../auth.js";

const router = Router();

router.use(authMiddleware);

const uploadsDir = path.resolve("./uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get("/drive/files", async (req: Request, res: Response) => {
  try {
    const folderId = req.query.folderId as string | undefined;

    const conditions = [isNull(schema.driveFiles.deleted_at)];

    if (folderId) {
      conditions.push(eq(schema.driveFiles.folder_id, folderId));
    }

    const files = await db.query.driveFiles.findMany({
      where: and(...conditions),
      orderBy: (driveFiles, { desc }) => [desc(driveFiles.created_at)],
    });

    res.json({ files });
  } catch (err) {
    console.error("List files error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/drive/files/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const folderId = req.body.folderId || null;

      const [file] = await db
        .insert(schema.driveFiles)
        .values({
          name: req.file.originalname,
          folder_id: folderId,
          owner_id: req.userId!,
          mime_type: req.file.mimetype,
          size_bytes: req.file.size,
          storage_path: req.file.path,
        })
        .returning();

      res.status(201).json({ file });
    } catch (err) {
      console.error("Upload file error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get("/drive/files/:id", async (req: Request, res: Response) => {
  try {
    const file = await db.query.driveFiles.findFirst({
      where: and(
        eq(schema.driveFiles.id, req.params.id),
        isNull(schema.driveFiles.deleted_at)
      ),
    });

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.json({ file });
  } catch (err) {
    console.error("Get file error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/drive/files/:id/download", async (req: Request, res: Response) => {
  try {
    const file = await db.query.driveFiles.findFirst({
      where: and(
        eq(schema.driveFiles.id, req.params.id),
        isNull(schema.driveFiles.deleted_at)
      ),
    });

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    if (!fs.existsSync(file.storage_path)) {
      res.status(404).json({ error: "File not found on disk" });
      return;
    }

    res.download(file.storage_path, file.name);
  } catch (err) {
    console.error("Download file error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/drive/files/:id", async (req: Request, res: Response) => {
  try {
    const file = await db.query.driveFiles.findFirst({
      where: eq(schema.driveFiles.id, req.params.id),
    });

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    await db
      .update(schema.driveFiles)
      .set({ deleted_at: new Date() })
      .where(eq(schema.driveFiles.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    console.error("Delete file error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
