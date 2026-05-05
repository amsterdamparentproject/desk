import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: {
        schema: 'activities',
      },
      auth: {
        persistSession: false, // Ensures it behaves as a pure stateless admin client
      },
    }
  )
}

const createBaseServerClient = async (
  schema: "public" | "directory" | "activities" = "public",
) => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema },
      auth: {
        persistSession: false, // Ensures it behaves as a pure stateless admin client
      },
    },
  );
};

// 2. Specialized exported clients (Explicitly async to pass through the cookie Promise)
export const createPublicClient = async () => 
  await createBaseServerClient("public");

export const createActivitiesClient = async () => 
  await createBaseServerClient("activities");