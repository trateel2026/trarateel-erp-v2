import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kuchedptsdnnwfgkesvq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1Y2hlZHB0c2RubndmZ2tlc3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDg0MzUsImV4cCI6MjA5NzAyNDQzNX0.wdIktGf_2n7uyXqJOWF7WtbQLM0qKkVlsSbyB9WDcAk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
