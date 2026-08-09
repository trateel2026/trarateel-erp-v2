# Daily Backup → Email

## 1. Create free Resend account
https://resend.com → API Keys → Create key

## 2. Set Supabase secrets
Supabase Dashboard → Project Settings → Edge Functions → Secrets:

RESEND_API_KEY=re_xxxx
BACKUP_TO_EMAIL=your@email.com
BACKUP_FROM_EMAIL=onboarding@resend.dev

(For production domain email, verify domain in Resend and use e.g. backup@yourdomain.com)

## 3. Deploy function
```bash
npx supabase login
npx supabase link --project-ref nrfipvfempsnozzpmoqg
npx supabase functions deploy daily-backup --no-verify-jwt
```

## 4. Schedule daily (Oman midnight ≈ 20:00 UTC)
Dashboard → Edge Functions → daily-backup → Schedules
Cron: `0 20 * * *`

Or SQL (pg_cron + net) if preferred.

## 5. Test
Dashboard → Edge Functions → daily-backup → Invoke
