import { NextResponse } from "next/server";
import { scanWorkflows } from "../../../../api/services/workflow-scanner.ts";
import { getWorkflowDir } from "../../../../api/services/singleton.ts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const all = await scanWorkflows(getWorkflowDir());
  const workflow = all.find(
    (w) => w.id === id || w.relativePath === decodeURIComponent(id)
  );
  if (!workflow) {
    return NextResponse.json({ message: "Workflow not found" }, { status: 404 });
  }
  return NextResponse.json(workflow);
}
