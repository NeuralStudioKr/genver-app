import { Router, Request, Response } from "express";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../auth.js";

const router = Router();

router.use(authMiddleware);

router.get("/users", async (_req: Request, res: Response) => {
  try {
    const users = await db.query.users.findMany({
      columns: {
        id: true,
        email: true,
        display_name: true,
        type: true,
        bot_type: true,
        status: true,
        last_seen_at: true,
        created_at: true,
      },
      orderBy: (users, { asc }) => [asc(users.display_name)],
    });

    res.json({ users });
  } catch (err) {
    console.error("List users error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.params.id),
      columns: {
        id: true,
        email: true,
        display_name: true,
        type: true,
        bot_type: true,
        status: true,
        last_seen_at: true,
        created_at: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
