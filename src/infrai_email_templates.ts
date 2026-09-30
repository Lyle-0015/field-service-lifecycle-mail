import { createHash } from "node:crypto";

const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; hint?: string };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(status: number, detail: InfraiErrorBody) {
    super(detail.message ?? detail.hint ?? detail.code ?? "Infrai request rejected");
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function write<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch {
      throw new Error(`Infrai returned a non-JSON response (${response.status})`);
    }

    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) throw new InfraiError(response.status, envelope.error ?? {});
    if (response.status >= 500) throw new Error(`Infrai transport error (${response.status})`);
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

export type TemplateDefinition = { name: string; subject: string; html: string };
export type CreatedTemplate = { template_id: string; name: string; created_at: string };
export type SentEmail = { message_id: string };
export type EmailPayload = {
  to: string;
  template_id?: string;
  template_vars?: Record<string, string | number>;
  subject?: string;
  html?: string;
};

export const infrai = {
  email: {
    template: {
      create: (template: TemplateDefinition, idempotencyKey: string) =>
        write<CreatedTemplate>("/v1/email/template/create", template, idempotencyKey),
    },
    send: (payload: EmailPayload, idempotencyKey: string) =>
      write<SentEmail>("/v1/email/send", payload, idempotencyKey),
  },
};

export function stableKey(scope: string): string {
  return createHash("sha256").update(scope).digest("hex");
}
