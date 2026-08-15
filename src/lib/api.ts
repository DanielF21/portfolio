/**
 * Where the browser sends API requests.
 *
 * This is a same-origin path, not a hostname, and that is the whole point. The
 * real backend origin lives in `BACKEND_URL`, a SERVER ONLY variable with no
 * `NEXT_PUBLIC_` prefix, and a rewrite in `next.config.mjs` forwards
 * `/api/backend/*` to it.
 *
 * The earlier version of this file used `NEXT_PUBLIC_API_URL`. That works, but
 * `NEXT_PUBLIC_*` values are inlined into the client bundle at build time, so
 * the backend hostname ended up in the JavaScript served to every visitor and
 * in the network tab on the first move. Nothing here reaches the browser now
 * except the string below.
 *
 * Side benefit: requests are same-origin, so CORS is not involved.
 */
export const API_URL = "/api/backend";
