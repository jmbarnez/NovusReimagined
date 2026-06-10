const fs = require('fs');

const [file, name, order, modes, initName, syncExpr, destroyName] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node append-desc.cjs <file> <name> <order> <modes> <init> <sync> <destroy>');
  process.exit(1);
}

let content = fs.readFileSync(file, 'utf8');

// Add AppMode import if not present
if (!content.includes('AppMode')) {
  // Find state.js import
  const stateImport = content.match(/import\s+\{([^}]*)\}\s+from\s+["']\.\.\/state\.js["']/);
  if (stateImport) {
    const items = stateImport[1].split(',').map(s => s.trim());
    if (!items.includes('AppMode')) {
      const newItems = [...items, 'AppMode'].join(', ');
      content = content.replace(stateImport[0], `import { ${newItems} } from "../state.js";`);
    }
  }
}

// Add RenderSubsystem import if not present
if (!content.includes('RenderSubsystem')) {
  const firstImport = content.match(/import\s+/);
  if (firstImport) {
    const idx = firstImport.index;
    content = content.slice(0, idx) + `import type { RenderSubsystem } from "./lifecycle.js";\n` + content.slice(idx);
  }
}

// Append descriptor
const syncBody = syncExpr === 'noargs' ? `${initName.replace('init', 'sync')}` :
                 syncExpr === 'ctx-now' ? `${initName.replace('init', 'sync')}(ctx.now)` :
                 syncExpr === 'ctx-now-sys' ? `${initName.replace('init', 'sync')}(ctx.now, ctx.sys)` :
                 syncExpr === 'ctx-now-alpha-sys' ? `${initName.replace('init', 'sync')}(ctx.now, ctx.alpha, ctx.sys)` :
                 syncExpr === 'ctx-now-alpha-dt-sys' ? `${initName.replace('init', 'sync')}(ctx.now, ctx.alpha, ctx.dt, ctx.sys)` :
                 syncExpr === 'ctx-alpha-now' ? `${initName.replace('init', 'sync')}(ctx.alpha, ctx.now)` :
                 syncExpr === 'ctx-width-height-now' ? `${initName.replace('init', 'sync')}(ctx.width, ctx.height, ctx.now)` :
                 syncExpr === 'ctx-now-width-height' ? `${initName.replace('init', 'sync')}(ctx.now, ctx.width, ctx.height)` :
                 syncExpr === 'custom-thrust' ? `syncThrust(ctx.alpha, ctx.now)` :
                 syncExpr;

const initRef = initName || '';
const destroyRef = destroyName || '';

const descriptor = `\n\nexport const ${name}Renderer: RenderSubsystem = {\n  name: "${name}",\n  ${initRef ? `init: ${initRef},\n  ` : ''}sync: (ctx) => {\n    ${syncBody};\n  },\n  ${destroyRef ? `destroy: ${destroyRef},\n  ` : ''}modes: [${modes}],\n  order: ${order},\n};\n`;

fs.writeFileSync(file, content + descriptor);
console.log(`Appended ${name}Renderer to ${file}`);
