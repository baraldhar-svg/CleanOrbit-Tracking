fetch('https://api.expo.dev/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '{ appBuild(id: "ecda0030-27d8-4c9d-afd7-943b0bcb47d1") { error { errorCode message } } }' })
}).then(r => r.json()).then(console.log).catch(console.error);
