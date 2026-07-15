import { NextResponse } from "next/server";
import {
  markStaleDevicesDisconnected,
  upsertDevice,
} from "@/lib/db/queries";

export const runtime = "nodejs";

const DEVICE_STALE_SECONDS = 120;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    mac_address?: string;
    ip_address?: string | null;
    vendor?: string | null;
  };

  if (!body.mac_address) {
    return NextResponse.json(
      { error: "mac_address is required" },
      { status: 400 }
    );
  }

  const device = upsertDevice({
    mac_address: body.mac_address,
    ip_address: body.ip_address ?? null,
    vendor: body.vendor ?? null,
  });

  markStaleDevicesDisconnected(DEVICE_STALE_SECONDS);

  return NextResponse.json(device);
}
