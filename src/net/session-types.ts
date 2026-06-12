export type ClientConnectionState = "disconnected" | "connecting" | "connected" | "disconnecting";

export interface WorkerNetEnvelope {
  clientId?: string;
  msg?: {
    type: string;
    payload?: unknown;
  };
}

export function parseWorkerNetEnvelope(data: Record<string, unknown>): WorkerNetEnvelope {
  const nested = data.payload as WorkerNetEnvelope | undefined;
  if (nested && typeof nested === "object" && ("clientId" in nested || "msg" in nested)) {
    return nested;
  }
  return {
    clientId: data.clientId as string | undefined,
    msg: data.msg as WorkerNetEnvelope["msg"],
  };
}
