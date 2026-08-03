import { Client } from 'pg';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const host = "aws-0-ap-southeast-2.pooler.supabase.com";
const projectRef = "yhhgfskamrtxwtluochz";

const testConfigs = [
  {
    name: "postgres.yhhgfskamrtxwtluochz, Decoded password, port 6543",
    user: `postgres.${projectRef}`,
    pass: "Istuti@98510",
    port: 6543
  },
  {
    name: "postgres, Decoded password, port 6543",
    user: "postgres",
    pass: "Istuti@98510",
    port: 6543
  },
  {
    name: "postgres.yhhgfskamrtxwtluochz, Decoded password, port 5432",
    user: `postgres.${projectRef}`,
    pass: "Istuti@98510",
    port: 5432
  },
  {
    name: "postgres, Decoded password, port 5432",
    user: "postgres",
    pass: "Istuti@98510",
    port: 5432
  },
  {
    name: "postgres.yhhgfskamrtxwtluochz, Encoded password, port 6543",
    user: `postgres.${projectRef}`,
    pass: "Istuti%4098510",
    port: 6543
  },
  {
    name: "postgres, Encoded password, port 6543",
    user: "postgres",
    pass: "Istuti%4098510",
    port: 6543
  }
];

async function run() {
  for (const config of testConfigs) {
    console.log(`Trying config: ${config.name}...`);
    const client = new Client({
      host,
      port: config.port,
      user: config.user,
      password: config.pass,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000
    });

    try {
      await client.connect();
      const res = await client.query("SELECT current_database(), now()");
      console.log(`SUCCESS! Connected successfully. DB info:`, res.rows[0]);
      console.log(`Working connection parameters: Host=${host}, Port=${config.port}, User=${config.user}, Pass=${config.pass}`);
      await client.end();
      process.exit(0);
    } catch (err: any) {
      console.log(`FAILED: ${err.message}`);
      try { await client.end(); } catch {}
    }
  }
  process.exit(1);
}

run();
