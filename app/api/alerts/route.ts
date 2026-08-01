import { NextResponse } from "next/server";
import { listAlerts } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(listAlerts());
}
