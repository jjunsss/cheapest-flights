import { existsSync } from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import type { FlightRunEvent, FlightSearchPayload } from "../shared/types.js";
import { openDatabase } from "./db.js";
import { RunEventHub } from "./events.js";
import { ensureRuntimeDirs, ROOT_DIR } from "./paths.js";
import { RunManager } from "./manager.js";
import { readRunReportFile, writeRunReports } from "./reports.js";

ensureRuntimeDirs();

const db = openDatabase();
const events = new RunEventHub();
const manager = new RunManager(db, events);
const app = Fastify({
  logger: true,
  bodyLimit: 1 * 1024 * 1024
});

app.get("/api/defaults", async () => manager.defaults());

app.post("/api/estimate", async (request, reply) => {
  try {
    return manager.estimate(request.body as FlightSearchPayload);
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/runs", async (request, reply) => {
  try {
    return await manager.createRun(request.body as FlightSearchPayload);
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/runs/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const detail = manager.getRun(id);
  if (!detail) {
    return reply.code(404).send({ error: "Run not found" });
  }
  return detail;
});

app.post("/api/runs/:id/pause", async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    return await manager.pause(id);
  } catch (error) {
    return reply.code(404).send({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/runs/:id/resume", async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    return await manager.resume(id);
  } catch (error) {
    return reply.code(404).send({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/runs/:id/events", async (request, reply) => {
  const { id } = request.params as { id: string };
  if (!manager.getRun(id)) {
    return reply.code(404).send({ error: "Run not found" });
  }

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  const send = (event: FlightRunEvent) => {
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  send({ type: "heartbeat", timestamp: new Date().toISOString() });
  const unsubscribe = events.subscribe(id, send);
  request.raw.on("close", unsubscribe);
});

app.get("/api/runs/:id/reports/:file", async (request, reply) => {
  const { id, file } = request.params as { id: string; file: string };
  if (!manager.getRun(id)) {
    return reply.code(404).send({ error: "Run not found" });
  }

  try {
    await writeRunReports(db, id);
    const body = await readRunReportFile(id, file);
    reply.type(contentType(file));
    return reply.send(body);
  } catch (error) {
    return reply.code(404).send({ error: error instanceof Error ? error.message : String(error) });
  }
});

const clientDistDir = path.join(ROOT_DIR, "dist", "client");
if (existsSync(path.join(clientDistDir, "index.html"))) {
  void app.register(fastifyStatic, {
    root: clientDistDir
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "Not Found", statusCode: 404 });
    }
    return reply.sendFile("index.html");
  });
}

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

function contentType(file: string): string {
  if (file.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (file.endsWith(".csv")) return "text/csv; charset=utf-8";
  return "application/json; charset=utf-8";
}
