const fs = require('fs');
const path = require('path');
const frontendNodeModules = path.resolve(__dirname + '/../hotelu1-main/frontend/node_modules');
const parser = require(path.join(frontendNodeModules, '@babel/parser'));

const files = [
  'hotelu1-main/frontend/src/ui/EmptyState.jsx',
  'hotelu1-main/frontend/src/ui/StatusPill.jsx',
  'hotelu1-main/frontend/src/components/Dashboard.jsx',
  'hotelu1-main/frontend/src/components/Login.jsx',
  'hotelu1-main/frontend/src/components/MenuManagement.jsx',
  'hotelu1-main/frontend/src/components/OrdersPage.jsx',
  'hotelu1-main/frontend/src/components/TakeawayManagement.jsx',
  'hotelu1-main/frontend/src/index.css',
];

// Resolve @babel/parser relative to the frontend node_modules (it is not hoisted to root).
const babelParserPath = path.join(__dirname + '/../hotelu1-main/frontend/node_modules/@babel/parser');

let ok = true;
for (const f of files) {
  const abs = path.resolve(__dirname + '/../' + f);
  const code = fs.readFileSync(abs, 'utf8');

  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
    console.log(f + ': PARSES OK | root: ' + ast.program.body.length + ' statements');
  } catch (e) {
    ok = false;
    const m = e.message.match(/line (\d+),? col (\d+)/i);
    console.log(f + ': PARSE FAILED at line ' + (m ? m[1] : '???') + ': ' + e.reasonCode + ' - ' + e.message.slice(0, 200));
  }
}
process.exit(ok ? 0 : 1);
