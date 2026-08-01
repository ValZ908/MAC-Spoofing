import { NextResponse } from "next/server";
import { getLatestHeartbeat } from "@/lib/db/queries";
import { getDetectorSupervisor } from "@/lib/detector/supervisor";

export const runtime = "nodejs";

const HEARTBEAT_STALE_MS = 25_000;

export async function GET() {
  const supervisor = getDetectorSupervisor();
  const status = supervisor.getStatus();
  const heartbeat = getLatestHeartbeat();
  const heartbeatOnline =
    heartbeat !== null &&
    Date.now() - new Date(heartbeat.last_seen).getTime() < HEARTBEAT_STALE_MS;

  return NextResponse.json({
    ...status,
    heartbeatOnline,
    lastHeartbeat: heartbeat,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: string;
    iface?: string;
  };

  const supervisor = getDetectorSupervisor();

  switch (body.action) {
    case "start":
      return NextResponse.json(supervisor.start({ iface: body.iface }));
    case "stop":
      return NextResponse.json(supervisor.stop());
    case "restart":
      return NextResponse.json(supervisor.restart({ iface: body.iface }));
    default:
      return NextResponse.json(
        { error: "action must be start, stop, or restart" },
        { status: 400 }
      );
  }
}
