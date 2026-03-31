import type { McpParticipant, StepResult } from "../model/index";

export async function executeMcp(participant: McpParticipant, _input: unknown): Promise<StepResult> {
  throw new Error(
    `mcp participant is not yet implemented (server: ${participant.server ?? "unspecified"}, tool: ${participant.tool ?? "unspecified"}). ` +
    "Use onError to handle this gracefully.",
  );
}
