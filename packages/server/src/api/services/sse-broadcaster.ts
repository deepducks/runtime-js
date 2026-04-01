export type SSEEvent =
  | { type: "trace:new"; executionId: string }
  | { type: "trace:updated"; executionId: string }
  | { type: "execution:finished"; executionId: string; status: "success" | "failure" };

export class SSEBroadcaster {
  private clients = new Set<(data: string) => void>();

  subscribe(send: (data: string) => void): () => void {
    this.clients.add(send);
    return () => this.clients.delete(send);
  }

  broadcast(event: SSEEvent): void {
    const data = JSON.stringify(event);
    for (const send of this.clients) {
      send(data);
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
