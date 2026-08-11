require('dotenv').config({path:'../../.env'});
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query("INSERT INTO tenants (id, name, school_code) VALUES (1, 'Orbit Default School', 'ORBIT_01') ON CONFLICT (id) DO NOTHING").then(() => {
    console.log('Tenant 1 seeded!');
    client.end();
  }).catch(e => {
    console.error('Insert error:', e);
    client.end();
  });
});
