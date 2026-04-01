import { NextResponse } from "next/server";
import { scanWorkflows } from "../../../api/services/workflow-scanner.ts";
import { getWorkflowDir } from "../../../api/services/singleton.ts";

export async function GET() {
  const data = await scanWorkflows(getWorkflowDir());
  return NextResponse.json(data);
}
