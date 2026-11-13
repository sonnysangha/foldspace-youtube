import type { AuthConfig } from "convex/server";

// CLERK_FRONTEND_API_URL is set on the deployment with `npx convex env set`.
export default {
  providers: [
    {
      domain: process.env.CLERK_FRONTEND_API_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
