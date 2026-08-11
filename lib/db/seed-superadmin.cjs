require('dotenv').config({path:'../../.env'});
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query("INSERT INTO users (phone, name, email, role, tenant_id) VALUES ('9851049147', 'Dhar Baral (Super Admin)', 'baraldhar@gmail.com', 'superadmin', 1) ON CONFLICT (phone) DO UPDATE SET role = 'superadmin', tenant_id = 1, email = 'baraldhar@gmail.com'").then(() => {
    console.log('Super Admin user seeded successfully!');
    client.end();
  }).catch(e => {
    console.error('Insert error:', e);
    client.end();
  });
});
