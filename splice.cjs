const fs = require('fs');
const content = fs.readFileSync('src/render/world.ts', 'utf8');
const startIndex = content.indexOf('// ── Star configuration tables');
const endIndex = content.indexOf('export function drawAsteroids');
if (startIndex !== -1 && endIndex !== -1) {
  const newContent = content.substring(0, startIndex) + 'export * from "./world/celestial.js";\nexport * from "./world/structures.js";\n\n' + content.substring(endIndex);
  fs.writeFileSync('src/render/world.ts', newContent);
  console.log('File updated successfully');
} else {
  console.log('Indices not found:', startIndex, endIndex);
}
