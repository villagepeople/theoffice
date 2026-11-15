import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const stripImports = source => source.replace(/^[\t ]*import[^\r\n]+;[\t ]*(?:\r?\n|$)/gm, '');
function wrap(name, source, dependency = '') {
  const names = [...source.matchAll(/export\s+(?:async\s+)?(?:const|let|class|function)\s+(\w+)/g)].map(match => match[1]);
  const clean = stripImports(source.replace(/\r\n?/g, '\n')).replace(/\bexport\s+(?=(?:async\s+)?(?:const|let|class|function)\b)/g, '');
  return 'const ' + name + ' = (() => {\n' + dependency + '\n' + clean + '\nreturn {' + names.join(',') + '};\n})();\n';
}
const assets = {};
for (const entry of await fs.readdir(path.join(root, 'dist'), { withFileTypes: true })) {
  if (!entry.isFile() || !types[path.extname(entry.name)] || entry.name.endsWith('.test.html')) continue;
  assets['/' + entry.name] = { type: types[path.extname(entry.name)], body: (await fs.readFile(path.join(root, 'dist', entry.name), 'utf8')).replace(/\r\n?/g, '\n') };
}
if (!assets['/index.html'] || !assets['/app.js']) throw new Error('The game assets are incomplete.');
const layout = await fs.readFile('dist/layout.js', 'utf8');
const model = await fs.readFile('dist/model.js', 'utf8');
const rooms = await fs.readFile('worker/room-service.js', 'utf8');
const worker = await fs.readFile('worker/index.js', 'utf8');
const layoutNames = [...layout.matchAll(/export\s+(?:async\s+)?(?:const|let|class|function)\s+(\w+)/g)].map(match => match[1]);
const output = wrap('LayoutModule', layout) +
  wrap('ModelModule', model, 'const {' + layoutNames.join(',') + '} = LayoutModule;') +
  wrap('RoomModule', rooms, 'const {GameModel,ROLES,OUTFITS,DIFFICULTIES} = ModelModule;const {normalizeLayout} = LayoutModule;') +
  wrap('WorkerModule', worker, 'const {D1RoomStore,RoomService,handleRoomRequest} = RoomModule;') +
  '\nconst GAME_ASSETS = ' + JSON.stringify(assets) + ';\nexport default WorkerModule.createWorker(GAME_ASSETS);\n';
await fs.mkdir('dist/server', { recursive: true });
await fs.mkdir('dist/.openai', { recursive: true });
await fs.writeFile('dist/server/index.js', output, 'utf8');
await fs.copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
console.log('Built server-backed game: ' + Object.keys(assets).length + ' embedded assets, ' + Buffer.byteLength(output) + ' bytes.');
