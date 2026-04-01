import { NextResponse } from "next/server";
import { listExecutions } from "../../../api/services/trace-reader.ts";
import { getTraceDirectory } from "../../../api/services/singleton.ts";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workflowId = searchParams.get("workflowId");

  const all = await listExecutions(getTraceDirectory());
  const filtered = workflowId
    ? all.filter((e) => e.execution.workflowId === workflowId)
    : all;
  return NextResponse.json(filtered);
}
