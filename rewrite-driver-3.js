const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'apps/frontend/src/components/portals/driver-portal.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Wrap "My Trips" content with myTripsOpen condition
// It is currently:
//              ) : (
//                <div className="divide-y divide-slate-700/60">
//                  {myTripHistory.map((t) => (
//                    <TripAccordionItem key={t.id} t={t} />
//                  ))}
//                </div>
//              )}
content = content.replace(
  /\) : \(\n\s*<div className="divide-y divide-slate-700\/60">\n\s*\{myTripHistory\.map\(\(t\) => \(\n\s*<TripAccordionItem key=\{t\.id\} t=\{t\} \/>\n\s*\)\)\}\n\s*<\/div>\n\s*\)\}/g,
  ') : (\n                myTripsOpen && (\n                  <div className="divide-y divide-border">\n                    {myTripHistory.map((t) => (\n                      <TripAccordionItem key={t.id} t={t} />\n                    ))}\n                  </div>\n                )\n              )}'
);

// 2. Disable Prev and Next buttons in Route Navigator when isFreezeActive
content = content.replace(
  /<button onClick=\{\(\) => setStationIdx\(\(i\) => Math\.max\(0, i - 1\)\)\} disabled=\{stationIdx === 0\}/g,
  '<button onClick={() => setStationIdx((i) => Math.max(0, i - 1))} disabled={stationIdx === 0 || isFreezeActive}'
);
content = content.replace(
  /<button onClick=\{\(\) => setStationIdx\(\(i\) => Math\.min\(driverStations\.length, i \+ 1\)\)\}\n\s*disabled=\{stationIdx >= driverStations\.length\}/g,
  '<button onClick={() => setStationIdx((i) => Math.min(driverStations.length, i + 1))}\n                    disabled={stationIdx >= driverStations.length || isFreezeActive}'
);

// 3. Disable the Go Live button in header
// Look for handleToggleOffline button
content = content.replace(
  /onClick=\{journeyStarted && !journeyCompleted \? undefined : handleToggleOffline\}\n\s*disabled=\{journeyStarted && !journeyCompleted\}/g,
  'onClick={journeyStarted && !journeyCompleted || isFreezeActive ? undefined : handleToggleOffline}\n                disabled={journeyStarted && !journeyCompleted || isFreezeActive}'
);

fs.writeFileSync(file, content);
console.log('Final driver tweaks applied!');
