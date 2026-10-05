// DEV-ONLY connectivity check — not bundled into the app.
// Inserts one test report (no photo) and reads it back from public_reports.
// Usage:  npm run test:supabase      (reads .env via --env-file)
// The test row has title "[TEST] ..." — delete it afterwards in the Table Editor.
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("✗ .env eksik: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const id = globalThis.crypto.randomUUID();

async function main() {
  console.log(`→ Inserting test report ${id} …`);
  const { error: insertError } = await supabase.from("reports").insert({
    id,
    category: "other",
    title: "[TEST] Bağlantı testi",
    description: "scripts/test-supabase.ts tarafından eklendi; silinebilir.",
    latitude: 37.3212,
    longitude: 40.7245,
    photo_url: null,
    anonymous: true,
    reporter_name: null,
    reporter_email: null,
    authority: "İlgili kurum",
  });
  if (insertError) throw new Error(`insert failed: ${insertError.message} (${insertError.code ?? "?"})`);
  console.log("✓ insert ok");

  const { data, error } = await supabase.from("public_reports").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`select failed: ${error.message} (${error.code ?? "?"})`);
  if (!data) throw new Error("row not visible in public_reports");
  console.log("✓ read back from public_reports:", data);
  if (data.reporter_name !== null) throw new Error("reporter_name should be null for anonymous reports");
  console.log("✓ anonymous reporter_name is null");
  console.log(`\nAll good. Delete the test row (id ${id}) from the reports table when done.`);
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
