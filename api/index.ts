if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:Istuti%4098510@db.yhhgfskamrtxwtluochz.supabase.co:5432/postgres";
}
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = "dev_secret_session_key_for_local_testing";
}

import app from "../backend/src/app";

export default app;
