const fs = require('fs');

const file = process.argv[2];
const name = process.argv[3];
const order = process.argv[4];
const modes = process.argv[5];
const syncCall = process.argv[6];
const destroyRef = process.argv[7];

let s = fs.readFileSync(file, 'utf8');

// Add AppMode + RenderSubsystem imports if not present
if (!s.includes('AppMode')) {
  const stateImport = s.match(/import\s+\{([^}]*)\}\s+from\s+["']\.\.\/state\.js["']/);
  if (stateImport) {
    const items = stateImport[1].split(',').map(x => x.trim());
    if (!items.includes('AppMode')) {
      const newItems = [...items, 'AppMode'].join(', ');
      s = s.replace(stateImport[0], `import { ${newItems} } from "../state.js";`);
    }
  } else {
    // No state.js import; add one at top
    s = `import { AppMode } from "../state.js";\n` + s;
  }
}

if (!s.includes('RenderSubsystem')) {
  const firstImport = s.match(/import\s+/);
  if (firstImport) {
    const idx = firstImport.index;
    s = s.slice(0, idx) + `import type { RenderSubsystem } from "./lifecycle.js";\n` + s.slice(idx);
  }
}

// Remove any existing descriptors appended by previous runs (look for RenderSubsystem block at end)
const existingDesc = s.lastIndexOf('export const ');
if (existingDesc > 0 && s.slice(existingDesc).includes('RenderSubsystem')) {
  s = s.slice(0, existingDesc);
}

let desc = `\n\nexport const ${name}Renderer: RenderSubsystem = {\n  name: "${name}",\n`;
desc += `  sync: (ctx) => {\n    ${syncCall};\n  },\n`;
if (destroyRef && destroyRef !== 'none') {
  desc += `  destroy: ${destroyRef},\n`;
}
desc += `  modes: [${modes}],\n  order: ${order},\n};\n`;

fs.writeFileSync(file, s + desc);
console.log('Done:', name);
