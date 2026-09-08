import React from "react";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requested = Number(url.searchParams.get("size"));
  const size = requested === 192 ? 192 : 512;
  const source = new URL("/api/app-icon?v=full-logo-mac-2", req.url).toString();

  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050607",
        },
      },
      React.createElement("img", {
        src: source,
        width: size,
        height: size,
        style: { width: "100%", height: "100%", objectFit: "cover" },
      })
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=86400, immutable",
      },
    }
  );
}
