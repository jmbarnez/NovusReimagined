const fs = require('fs');

const file = process.argv[2];
const name = process.argv[3];
const order = process.argv[4];
const modes = process.argv[5];
const syncCall = process.argv[6];
const destroyRef = process.argv[7];

let s = fs.readFileSync(file, 'utf8');

if (!s.includes('AppMode')) {
  s = s.replace('import { Client } from "../state.js";', 'import { AppMode, Client } from "../state.js";\nimport type { RenderSubsystem } from "./lifecycle.js";');
}

let desc = `\n\nexport const ${name}Renderer: RenderSubsystem = {\n  name: "${name}",\n`;
if (fs.existsSync(file) && s.includes('init')) {
  // leave init out if there's no matching init function
}
desc += `  sync: (ctx) => {\n    ${syncCall};\n  },\n`;
if (destroyRef && destroyRef !== 'none') {
  desc += `  destroy: ${destroyRef},\n`;
}
desc += `  modes: [${modes}],\n  order: ${order},\n};\n`;

fs.writeFileSync(file, s + desc);
console.log('Done:', name);
