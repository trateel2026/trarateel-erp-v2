import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nrfipvfempsnozzpmoqg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZmlwdmZlbXBzbm96enBtb3FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNDU2NjcsImV4cCI6MjEwMTcyMTY2N30.E7odOoR3ZtP2jjkmnVTr2TyU4SLIbI_skYI2fxBipXE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
