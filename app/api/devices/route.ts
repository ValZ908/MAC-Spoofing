import { NextResponse } from "next/server";
import { listDevices } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(listDevices());
}
