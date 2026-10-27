const fs = require('fs');
const path = require('path');
const files = [
  'hotelu1-main/frontend/src/ui/EmptyState.jsx',
  'hotelu1-main/frontend/src/ui/StatusPill.jsx',
];
for (const f of files) {
  const code = fs.readFileSync(path.resolve(__dirname + '/../' + f), 'utf8');
  let j = 0, inS = null, esc = false;
  const stack = [];
  while (j < code.length) {
    const c = code[j];
    if (inS) {
      if (esc) { esc = false; j += 2; continue; }
      if (c === '\\') { esc = true; j++; continue; }
      if (c === inS) {
        const s = stack.pop();
        console.log(f + ': close quote ' + inS + ' at line ' + (code.slice(0, j).split('\n').length) +
          ', matched with start at line ' + (s.line) + ' col ' + s.col + ': ' + JSON.stringify(code.slice(s.pos, j)));
        inS = null;
      }
      j++; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inS = c;
      stack.push({ pos: j, line: code.slice(0, j).split('\n').length, col: code.slice(0, j).split('\n').pop().length });
    }
    j++;
  }
  console.log(f, 'ends-in-string:', !!inS, 'stack at end:', stack.map(s => s.line).join(','));
}
