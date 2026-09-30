import { createServer } from "node:http";
import { ZodError, z } from "zod";
import { InfraiError } from "./infrai_email_templates.ts";
import { workOrderMailSchema } from "./lifecycle_policy.ts";
import { createLifecycleTemplates, sendWorkOrderMail } from "./work_order_templates.ts";

const requestSchema = z.object({
  namespace: z.string().regex(/^[a-z0-9-]+$/),
  workOrder: workOrderMailSchema,
});

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/work-order-mail") {
    response.writeHead(404).end(JSON.stringify({ error: "route not found" }));
    return;
  }

  try {
    const body = requestSchema.parse(await readJson(request));
    const runNamespace = `${body.namespace}-${Date.now()}`;
    const templateIds = await createLifecycleTemplates(runNamespace);
    const sent = await sendWorkOrderMail(body.workOrder, templateIds);
    response.writeHead(201).end(JSON.stringify(sent));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "invalid request body" }));
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status).end(JSON.stringify({ error: error.message }));
      return;
    }
    console.error(error);
    response.writeHead(502).end(JSON.stringify({ error: "email operation failed" }));
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Work-order mail service listening on http://localhost:${port}`));
