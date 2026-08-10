const https = require('https');
const sessionSecret = '{"id":"345a1e80-5496-45b7-bb81-759a90e3eaf1","version":2}';

const query = `
  query AppBuildById($id: ID!) {
    appBuilds(where: { id: $id }) {
      id
      status
      error {
        message
      }
    }
  }
`;

const data = JSON.stringify({
  query: query,
  variables: { id: "5f68d51b-6bcb-4027-b90c-9d8db85cf2e3" }
});

const options = {
  hostname: 'api.expo.dev',
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'expo-session': sessionSecret,
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
