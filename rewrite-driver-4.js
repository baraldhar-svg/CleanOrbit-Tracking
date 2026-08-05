const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'apps/frontend/src/components/portals/driver-portal.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\) : \(\s*<div className="divide-y divide-slate-700\/60">\s*\{myTripHistory\.map\(\(t\) => \(\s*<TripAccordionItem key=\{t\.id\} t=\{t\} \/>\s*\)\)\}\s*<\/div>\s*\)\}/g,
  ') : (myTripsOpen && <div className="divide-y divide-border">{myTripHistory.map((t) => (<TripAccordionItem key={t.id} t={t} />))}</div>)}'
);

content = content.replace(
  /<button onClick=\{\(\) => setStationIdx\(\(i\) => Math\.max\(0, i - 1\)\)\} disabled=\{stationIdx === 0\}/g,
  '<button onClick={() => setStationIdx((i) => Math.max(0, i - 1))} disabled={stationIdx === 0 || isFreezeActive}'
);

content = content.replace(
  /<button onClick=\{\(\) => setStationIdx\(\(i\) => Math\.min\(driverStations\.length, i \+ 1\)\)\}\s*disabled=\{stationIdx >= driverStations\.length\}/g,
  '<button onClick={() => setStationIdx((i) => Math.min(driverStations.length, i + 1))} disabled={stationIdx >= driverStations.length || isFreezeActive}'
);

content = content.replace(
  /onClick=\{journeyStarted && !journeyCompleted \? undefined : handleToggleOffline\}\s*disabled=\{journeyStarted && !journeyCompleted\}/g,
  'onClick={journeyStarted && !journeyCompleted || isFreezeActive ? undefined : handleToggleOffline} disabled={journeyStarted && !journeyCompleted || isFreezeActive}'
);

fs.writeFileSync(file, content);
console.log('Final driver tweaks applied via rewrite script!');
