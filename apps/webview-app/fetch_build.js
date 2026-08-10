const https = require('https');
const sessionSecret = '{"id":"345a1e80-5496-45b7-bb81-759a90e3eaf1","version":2}';

const options = {
  hostname: 'api.expo.dev',
  path: '/v2/projects/a496a150-e4da-41b2-b3e6-b9063017ca8e/builds/5f68d51b-6bcb-4027-b90c-9d8db85cf2e3',
  method: 'GET',
  headers: {
    'expo-session': sessionSecret
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});

req.on('error', e => console.error(e));
req.end();
