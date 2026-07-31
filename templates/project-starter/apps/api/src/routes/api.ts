import { Hono } from "hono";

export const apiRouter = new Hono();

apiRouter.get("/items", (c) => {
  return c.json({ items: [] });
});

apiRouter.post("/items", async (c) => {
  const body = await c.req.json();
  return c.json({ created: body }, 201);
});
