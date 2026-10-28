"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { handleApi, resolveMode, setMode, DEMO_USER_ID } from "./store";

// Installs the demo's fake network layer, then renders the page. Both the
// SWR fetcher (window.fetch) and GlobalApi (axios) are redirected to the
// in-memory mock for any /api/* call; everything else passes through.
//
// The page is gated behind `ready` so interception is live BEFORE the
// reused dashboard pages fire their first fetch (child effects run before
// parent effects, so without this gate the first SWR call would hit the
// real, auth-gated API).
//
// Also rewrites clicks on the reused pages' links:
//   /dashboard/*  -> /demo/*       (capture phase, beats Next's <Link>)
//   /api/auth/*   -> /start        (Logout / Login chrome inside reused
//                                   pages must never bounce a demo visitor
//                                   through Kinde)
export default function MockProvider({ children }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Solo vs family seed — URL ?mode= wins, else the tab's stored choice.
    setMode(resolveMode(searchParams));

    // Identity hint for reused pages that normally ask Kinde who's signed
    // in (chat alignment, "own message" affordances). See useViewerId().
    window.__ETCH_DEMO_USER_ID__ = DEMO_USER_ID;

    const origFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input?.url;
      if (url && url.startsWith("/api/")) {
        const method = init?.method || (typeof input !== "string" && input?.method) || "GET";
        let body;
        if (init?.body) {
          try {
            body = JSON.parse(init.body);
          } catch {
            body = init.body;
          }
        }
        const { status, data } = handleApi(method, url, body);
        return new Response(JSON.stringify(data), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return origFetch(input, init);
    };

    const origAdapter = axios.defaults.adapter;
    axios.defaults.adapter = async (config) => {
      const url = config.url || "";
      if (url.startsWith("/api/")) {
        const method = (config.method || "get").toUpperCase();
        let body = config.data;
        if (typeof body === "string") {
          try {
            body = JSON.parse(body);
          } catch {
            /* leave as-is */
          }
        }
        const { status, data } = handleApi(method, url, body);
        if (status >= 400) {
          const err = new Error("Request failed with status " + status);
          err.response = { status, data, config, headers: {} };
          return Promise.reject(err);
        }
        return { data, status, statusText: "OK", headers: {}, config, request: {} };
      }
      if (typeof origAdapter === "function") return origAdapter(config);
      // Demo only ever calls /api/*; this branch shouldn't be reached.
      return Promise.reject(new Error("no axios adapter for " + url));
    };

    setReady(true);
    return () => {
      window.fetch = origFetch;
      axios.defaults.adapter = origAdapter;
      delete window.__ETCH_DEMO_USER_ID__;
    };
  }, [searchParams]);

  useEffect(() => {
    function onClick(e) {
      const a = e.target?.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      if (href.startsWith("/dashboard")) {
        e.preventDefault();
        e.stopPropagation();
        const dest = "/demo" + href.slice("/dashboard".length);
        router.push(dest || "/demo");
      } else if (href.startsWith("/api/auth/")) {
        e.preventDefault();
        e.stopPropagation();
        router.push("/start");
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  if (!ready) return null;
  return children;
}
