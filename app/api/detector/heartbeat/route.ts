import { NextResponse } from "next/server";
import { upsertDetectorHeartbeat } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let hostname = "detector";
  try {
    const body = (await request.json()) as { hostname?: string };
    if (body.hostname) hostname = String(body.hostname);
  } catch {
    // Empty body is fine — use default hostname.
  }

  const heartbeat = upsertDetectorHeartbeat(hostname);
  return NextResponse.json(heartbeat);
}
