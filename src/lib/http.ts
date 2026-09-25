import { NextResponse } from "next/server";
import { AuthError } from "./auth";

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

// Converts auth failures into proper 401/403 responses instead of unhandled 500s.
export function api<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.status === 401 ? "Unauthorized" : "Forbidden" }, { status: error.status });
      }
      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      console.error(error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  };
}

export const badRequest = (error: unknown) => NextResponse.json({ error }, { status: 400 });
