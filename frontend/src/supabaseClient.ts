import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ Supabase environment variables are missing."
  );
  console.error("Please create a .env.local file with:");
  console.error("REACT_APP_SUPABASE_URL=your_supabase_url");
  console.error("REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key");
} else {
  supabase = createClient(supabaseUrl, supabaseKey);
}

export { supabase };
