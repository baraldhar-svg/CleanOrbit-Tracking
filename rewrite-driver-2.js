const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'apps/frontend/src/components/portals/driver-portal.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/hover:bg-slate-600/g, 'hover:bg-muted-foreground/20');
content = content.replace(/bg-slate-600/g, 'bg-muted-foreground/30');
content = content.replace(/bg-slate-950/g, 'bg-background');

content = content.replace(/bg-slate-500/g, 'bg-muted-foreground');
content = content.replace(/text-slate-900/g, 'text-primary-foreground');

// The text-white inside gradients is fine, but text-white elsewhere might be problematic in light mode.
// We already handled text-white in the main container, but let's check for specific ones
content = content.replace(/text-white shadow/g, 'text-primary-foreground shadow');

fs.writeFileSync(file, content);
console.log('Driver portal tweaks updated successfully!');
