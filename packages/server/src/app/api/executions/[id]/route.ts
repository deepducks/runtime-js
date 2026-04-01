import { NextResponse } from "next/server";
import { getExecution } from "../../../../api/services/trace-reader.ts";
import { getTraceDirectory } from "../../../../api/services/singleton.ts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trace = await getExecution(getTraceDirectory(), id);
  if (!trace) {
    return NextResponse.json({ message: "Execution not found" }, { status: 404 });
  }
  return NextResponse.json(trace);
}
