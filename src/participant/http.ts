import type { StepResult } from "../model/index";

export default async function executeHttp(participant: { url: string; method?: string; headers?: Record<string, string>; body?: unknown }, input?: string): Promise<StepResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const method = (participant.method ?? "GET").toUpperCase();
  const url = participant.url;
  const headers = participant.headers ?? {};
  let body: unknown = participant.body;
  if ((body === undefined || body === null) && input !== undefined) {
    body = input;
  }

  const fetchOptions: RequestInit = { method, headers: headers as HeadersInit };
  if (body !== undefined) fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);

  const res = await fetch(url, fetchOptions);
  const text = await res.text();
  const duration = Date.now() - start;

  if (!res.ok) {
    const err: Error & { status?: number; body?: string } = new Error(`http participant request failed: ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }

  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(text);
  } catch (_) {
    // ignore parse errors
  }

  return {
    status: "success",
    output: text,
    parsedOutput,
    duration,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
