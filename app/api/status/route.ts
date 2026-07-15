import { NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getDashboardSnapshot());
}
