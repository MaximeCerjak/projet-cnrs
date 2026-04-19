/**
 * server.ts — Client Supabase pour les Server Components / Route Handlers
 *
 * Pas de singleton : chaque requête serveur a sa propre instance.
 * Utilise la SERVICE_ROLE_KEY pour bypasser les RLS si nécessaire.
 *
 * Usage depuis un Server Component :
 *   import { getSupabaseServer } from '@/app/lib/supabase/server'
 *   const supabase = getSupabaseServer()
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/app/lib/types/database'

export function getSupabaseServer() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}