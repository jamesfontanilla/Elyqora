import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", service: "elyqora-free", timestamp: new Date().toISOString() });
}
