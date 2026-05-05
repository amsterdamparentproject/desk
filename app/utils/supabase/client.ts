import { createBrowserClient } from "@supabase/ssr";

// Generic base client
const createBaseClient = (schema: "public" | "directory" | "activities") =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema },
    },
  );

export const activitiesClient = () => createBaseClient("activities");
