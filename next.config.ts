import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
};

// Source-map upload (readable stack traces in Sentry) needs SENTRY_ORG,
// SENTRY_PROJECT, and SENTRY_AUTH_TOKEN — not set yet, so uploads are
// silently skipped and error reporting still works, just with minified
// stack traces. Add those three env vars later to enable it.
export default withSentryConfig(nextConfig, {
  silent: true,
});
