import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL as string
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY as string
const isProd = process.env.NODE_ENV === 'production'

const missing: string[] = []
if (!SUPABASE_URL) missing.push('SUPABASE_URL')
if (!SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY')
if (!SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_KEY')

if (missing.length) {
  const msg = `Missing Supabase env: ${missing.join(', ')}`
  console.warn(`[supabase] ${msg}. Supabase integration is optional, using SQLite for authentication and data storage.`)
}

// Use service key for server-side DB operations to avoid RLS friction.
export const supabaseClient = createClient(SUPABASE_URL || 'https://demo.supabase.co', SUPABASE_SERVICE_KEY || 'service')
export const supabaseAdmin = createClient(SUPABASE_URL || 'https://demo.supabase.co', SUPABASE_SERVICE_KEY || 'service')