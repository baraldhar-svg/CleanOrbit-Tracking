const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'apps/frontend/src/components/portals/driver-portal.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Theme replacements
// Replace background and text colors
content = content.replace(/bg-\[#0F172A\]/g, 'bg-background');
content = content.replace(/bg-slate-900\/60/g, 'bg-card/60');
content = content.replace(/bg-slate-900/g, 'bg-card');
content = content.replace(/bg-slate-800\/80/g, 'bg-card/80');
content = content.replace(/bg-slate-800\/60/g, 'bg-card/60');
content = content.replace(/bg-slate-800/g, 'bg-card');
content = content.replace(/bg-slate-700\/60/g, 'bg-muted/60');
content = content.replace(/bg-slate-700/g, 'bg-muted');

content = content.replace(/text-slate-100/g, 'text-foreground');
content = content.replace(/text-slate-200/g, 'text-foreground');
content = content.replace(/text-slate-300/g, 'text-muted-foreground');
content = content.replace(/text-slate-400/g, 'text-muted-foreground');
content = content.replace(/text-slate-500/g, 'text-muted-foreground');

content = content.replace(/border-slate-800/g, 'border-border');
content = content.replace(/border-slate-700/g, 'border-border');
content = content.replace(/border-slate-600/g, 'border-border');

// Replace specific text-white when used with the dark background
// (But NOT inside gradients, like bg-gradient-to-r from-amber-500...)
// The easiest way is to target the main container:
content = content.replace(/className="min-h-full w-full bg-background text-white flex flex-col"/g, 'className="min-h-full w-full bg-background text-foreground flex flex-col"');
content = content.replace(/className="min-h-full w-full bg-background text-white flex flex-col items-center/g, 'className="min-h-full w-full bg-background text-foreground flex flex-col items-center');

// 2. Disable Go Live button when isFreezeActive is true
content = content.replace(
  /disabled={isHolidayToday \|\| myDriver\?\.isActive === false}/g,
  'disabled={isHolidayToday || myDriver?.isActive === false || isFreezeActive}'
);
content = content.replace(
  /isHolidayToday \|\| myDriver\?\.isActive === false\n(\s+)\? "pointer-events-none/g,
  'isHolidayToday || myDriver?.isActive === false || isFreezeActive\n$1? "pointer-events-none'
);
// Also update the class for Go Live button when it's offline to support light mode
content = content.replace(
  /\? "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"/g,
  '? "bg-card border-border text-foreground hover:bg-muted"'
);

// 3. Make My Trips collapsible
// Step a: import ChevronDown, ChevronUp if not imported (lucide-react)
if (!content.includes('ChevronDown')) {
  content = content.replace(/HistoryIcon, X, User, Lock,/, 'HistoryIcon, X, User, Lock, ChevronDown, ChevronUp,');
}

// Step b: Add state for myTripsOpen
if (!content.includes('const [myTripsOpen, setMyTripsOpen] = useState(false);')) {
  content = content.replace(
    /const \[driverProfileOpen, setDriverProfileOpen\] = useState\(false\);/,
    'const [driverProfileOpen, setDriverProfileOpen] = useState(false);\n  const [myTripsOpen, setMyTripsOpen] = useState(false);'
  );
}

// Step c: Update the My Trips header to make it clickable
content = content.replace(
  /<div className="flex items-center gap-2 px-4 py-3 border-b border-border">/g,
  '<div \n                className="flex items-center gap-2 px-4 py-3 border-b border-border cursor-pointer hover:bg-muted/30 transition-colors"\n                onClick={() => setMyTripsOpen(!myTripsOpen)}\n              >'
);
content = content.replace(
  /<span className="ml-auto text-\[11px\] text-muted-foreground">{myTripHistory.length} recorded<\/span>/g,
  '<span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">\n                  {myTripHistory.length} recorded\n                  {myTripsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}\n                </span>'
);

// Step d: Wrap the trips list in a conditional based on myTripsOpen
// Note: We need to find the <ul> inside "My Trips" and wrap it.
content = content.replace(
  /<ul className="divide-y divide-border">/g,
  '{myTripsOpen && (\n              <ul className="divide-y divide-border">'
);
content = content.replace(
  /<\/ul>\n\s+<\/div>\n\s+\)}/g, // This matches the end of the ul and the enclosing div
  '</ul>\n              )}\n            </div>\n          )}'
);

// We should use a more precise regex for closing the myTripsOpen wrapper
const tripRegex = /(<ul className="divide-y divide-border">[\s\S]*?<\/ul>)/;
content = content.replace(tripRegex, '{myTripsOpen && (\n$1\n)}');

fs.writeFileSync(file, content);
console.log('Driver portal updated successfully!');
