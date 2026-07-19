import { NextResponse } from "next/server";
import {
  requestRoute,
  RoutingServiceError,
  validateRoutingRequest,
} from "@/lib/routing";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { type: "INVALID_REQUEST", message: "A valid JSON request body is required." } },
      { status: 400 }
    );
  }

  try {
    const coordinates = validateRoutingRequest(body);
    const route = await requestRoute(coordinates);
    return NextResponse.json(route);
  } catch (error) {
    if (error instanceof RoutingServiceError) {
      return NextResponse.json(
        { error: { type: error.code, message: error.message } },
        { status: error.status }
      );
    }
    console.error("POST /api/routing error:", error);
    return NextResponse.json(
      { error: { type: "ROUTING_PROVIDER_ERROR", message: "The route could not be generated." } },
      { status: 502 }
    );
  }
}