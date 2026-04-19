/**
 * client.ts — Client Supabase pour le navigateur (singleton)
 *
 * Usage depuis un composant client :
 *   import { getSupabaseClient } from '@/app/lib/supabase/client'
 *   const supabase = getSupabaseClient()
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/app/lib/types/database'

let client: ReturnType<typeof createClient<Database>> | null = null

export function getSupabaseClient() {
  if (!client) {
    client = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}