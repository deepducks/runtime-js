import { NextResponse } from "next/server";
import { executeWorkflowAsync } from "../../../api/services/executor.ts";
import { getTraceDirectory } from "../../../api/services/singleton.ts";

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.filePath || typeof body.filePath !== "string") {
    return NextResponse.json(
      { message: "filePath is required" },
      { status: 400 }
    );
  }

  executeWorkflowAsync({
    filePath: body.filePath,
    inputs: body.inputs ?? {},
    traceDir: getTraceDirectory(),
  });

  return NextResponse.json({ status: "started" }, { status: 202 });
}
