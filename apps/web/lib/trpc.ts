import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../api/src/routers";

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/trpc`,
      headers() {
        return {
          "x-trpc-source": "web",
        };
      },
    }),
  ],
});
