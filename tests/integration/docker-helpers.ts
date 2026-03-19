import { $ } from "bun";

export interface DockerContainer {
  id: string;
  host: string;
  port: number;
}

/**
 * Start a Docker container with a mapped port.
 * Returns container info or null if Docker is not available.
 */
export async function startContainer(
  image: string,
  containerPort: number,
  extraArgs: string[] = [],
): Promise<DockerContainer | null> {
  try {
    // Check Docker availability
    const check = await $`docker info`.quiet();
    if (check.exitCode !== 0) return null;
  } catch {
    return null;
  }

  try {
    const args = ["docker", "run", "-d", "-p", `0:${containerPort}`, image, ...extraArgs];
    const result = await $`${args}`.quiet();
    const id = result.text().trim();

    // Get mapped port
    const portResult = await $`docker port ${id} ${containerPort}`.quiet();
    const portLine = portResult.text().trim().split("\n")[0]; // e.g., "0.0.0.0:55001"
    const mappedPort = parseInt(portLine.split(":").pop()!, 10);

    // Wait for port to be reachable
    await waitForPort("127.0.0.1", mappedPort, 15_000);

    return { id, host: "127.0.0.1", port: mappedPort };
  } catch (err) {
    console.warn("Failed to start container:", (err as Error).message);
    return null;
  }
}

/** Stop and remove a Docker container. */
export async function stopContainer(container: DockerContainer): Promise<void> {
  try {
    await $`docker rm -f ${container.id}`.quiet();
  } catch {
    // ignore
  }
}

/** Wait until a TCP port accepts connections. */
async function waitForPort(host: string, port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const socket = await Bun.connect({
        hostname: host,
        port,
        socket: {
          data() {},
          open(socket) { socket.end(); },
          error() {},
          close() {},
        },
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`Port ${host}:${port} not reachable after ${timeoutMs}ms`);
}
