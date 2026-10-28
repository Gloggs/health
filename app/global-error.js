"use client";

import { useEffect } from "react";

// Last-resort error boundary. Catches errors thrown by app/layout.js
// itself (which is above the route-segment error.js). Because it sits
// outside the root layout, it MUST render its own <html><body> shell.
//
// Inline styles only — at the point this renders, the global CSS might
// not have loaded (the layout crashed before it could). Uses BRAND
// palette hex values directly so the page still feels like Etch.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("[app/global-error] caught:", error?.message ?? error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          backgroundColor: "#F8F5EF",
          color: "#1A1410",
        }}
      >
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              maxWidth: 440,
              width: "100%",
              borderRadius: 16,
              border: "1px solid #e5e0d6",
              background: "#fff",
              padding: 32,
              textAlign: "center",
              boxShadow: "0 1px 2px rgba(26, 20, 16, 0.04)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "#A4271E",
                color: "#fff",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              E
            </div>
            <p
              style={{
                margin: "12px 0 0",
                fontFamily: "Georgia, 'Source Serif 4', serif",
                fontSize: 13,
                fontWeight: 600,
                color: "#7a716a",
              }}
            >
              Etch
            </p>
            <h1
              style={{
                margin: "16px 0 0",
                fontFamily: "Georgia, 'Source Serif 4', serif",
                fontSize: 24,
                fontWeight: 700,
                color: "#1A1410",
              }}
            >
              The whole page cracked.
            </h1>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 14,
                lineHeight: 1.55,
                color: "#3a322c",
              }}
            >
              Something went wrong at the root. Your data is safe — try
              reloading the page.
            </p>
            {error?.digest ? (
              <p
                style={{
                  margin: "8px 0 0",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: 10,
                  color: "#9a918a",
                }}
              >
                Reference: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: 20,
                padding: "12px 24px",
                borderRadius: 10,
                border: "none",
                background: "#A4271E",
                color: "#fff",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                width: "100%",
              }}
            >
              Reload
            </button>
            <a
              href="/"
              style={{
                display: "inline-block",
                marginTop: 12,
                fontSize: 12,
                color: "#7a716a",
                textDecoration: "none",
              }}
            >
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
