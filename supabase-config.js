const SUPABASE_URL =
  "https://eazrmfpenscpmwnuyyhs.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_XbetaS_5eFBSyb68L87F7Q_MC64GhW7";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );