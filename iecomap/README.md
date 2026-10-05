# EcoMap (Mardin)

Expo / React Native app (Expo SDK 57, Expo Router) for environmental points and citizen reports in Mardin.

```bash
npm install
npx expo start          # scan the QR code with Expo Go
npx tsc --noEmit        # typecheck
npm run check:weather-codes
```

## Backend: Supabase

User reports are stored in a shared Supabase database, so reports from every phone appear on the map.
The app does **not** use Supabase Auth; every request uses the project's publishable (anon) key.

### `.env`

Create `.env` in the project root (copy `.env.example`):

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL, e.g. `https://<project-ref>.supabase.co` (Dashboard → Project Settings → API) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | The **publishable** (anon) key, `sb_publishable_…`. Never put the secret / service-role key here. |

`.env` is git-ignored. `EXPO_PUBLIC_*` variables are inlined into the app bundle at build time, so they are
visible to anyone who has the app — that's expected for the publishable key; access is limited by the
database policies below. Restart `npx expo start` after editing `.env`.

If `.env` is missing or Supabase is unreachable, the app keeps working: the map shows seed points and the last
loaded reports, and new reports go to an offline queue.

### Database objects the app expects

- Table `reports` — `id uuid` (generated on the phone), `created_at`, `category` (`electric_fault` |
  `other_issue` | `other`), `title`, `description`, `latitude`, `longitude`, `photo_url`, `anonymous`,
  `reporter_name`, `reporter_email`, `authority`, `status` (`yeni` | `iletildi` | `cozuldu`, default `yeni`).
- View `public_reports` — same columns without `reporter_email`; `reporter_name` is null when anonymous.
- Policies: `anon` may **INSERT** into `reports` and **SELECT** from `public_reports` only.
- Storage: public bucket `sazecomap`; `anon` may upload (INSERT) only. Photos are stored as
  `reports/<YYYY-MM-DD>/<report-id>.jpg`.

### How reports flow

1. The report form uploads the photo to `sazecomap`, then inserts a row into `reports` with the
   authority name from `src/routing.ts`. The user sees "Takip no: <first 8 chars of id>".
2. Anonymous reports send `anonymous = true`, `reporter_name = null`, `reporter_email = null`.
3. No network → the report is saved in an AsyncStorage queue (photo copied to the app's document folder)
   and retried on app start, whenever the map screen gains focus, and every ~30 s while the map is open.
   Retries reuse the same id, so a report is never inserted twice.
4. The map loads the newest 200 rows from `public_reports` on focus and every ~30 s.

### Viewing / managing reports

Supabase Dashboard → **Table Editor** → `reports`. Here you can see every report (including
`reporter_email` for non-anonymous ones) and change `status` to `iletildi` ("İlgili kuruma iletildi") or
`cozuldu` ("Çözüldü"); the new status shows on the map within ~30 s. Photos are under
**Storage** → `sazecomap`.

### Connectivity check (dev only)

```bash
npm run test:supabase
```

Inserts one anonymous `[TEST]` report without a photo and reads it back from `public_reports`.
Delete the test row from the Table Editor afterwards.

### Future option: e-mailing institutions (not implemented)

Reports are **not** sent to institutions automatically yet. A possible approach: a Supabase
**Database Webhook** on `INSERT` into `reports` → an **Edge Function** that picks the institution's
address by `category` / `authority` and sends an e-mail through a provider (e.g. Resend, SendGrid),
then sets `status = 'iletildi'`.
