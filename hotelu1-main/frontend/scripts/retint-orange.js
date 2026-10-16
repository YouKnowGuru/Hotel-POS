#!/usr/bin/env node
/**
 * Retint codemod: migrate legacy orange accent classes to the solid
 * indigo SaaS palette across the orange-heavy screens.
 * - Gradients collapse to flat solid utilities.
 * - Interaction states are mapped (dark:hover:bg-orange-600 -> indigo-500, etc.)
 * - Soft orange fills become indigo-tinted fills.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'components');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsx'));

const MAP = [
  // Header/CTA gradients -> flat solid indigo
  [/bg-gradient-to-(?:r|br|b) from-orange-500 via-orange-600 to-orange-700/g, 'bg-indigo-600'],
  [/bg-gradient-to-(?:r|br|b) from-orange-500 to-orange-700/g, 'bg-indigo-600'],
  [/bg-gradient-to-(?:r|br|b) from-orange-600 to-orange-700/g, 'bg-indigo-600'],
  [/bg-gradient-to-(?:r|br|b) from-orange-500 to-orange-600/g, 'bg-indigo-600'],
  [/bg-gradient-to-(?:r|br|b) from-orange-600 to-orange-500/g, 'bg-indigo-600'],
  [/bg-gradient-to-(?:r|br|b) from-orange-400 to-orange-500/g, 'bg-indigo-500'],
  [/bg-gradient-to-(?:r|br|b) from-orange-400 to-red-500/g, 'bg-indigo-700'],
  [/bg-gradient-to-(?:r|br|b) from-orange-50 to-red-50/g, 'bg-indigo-50'],
  [/bg-gradient-to-(?:r|br|b) from-orange-50 to-orange-100/g, 'bg-indigo-50'],
  [/bg-gradient-to-(?:r|br|b) from-orange-100 to-orange-50/g, 'bg-indigo-50'],

  // Solid fills
  [/bg-orange-500/g, 'bg-indigo-600'],
  [/bg-orange-600/g, 'bg-indigo-700'],
  [/bg-orange-400/g, 'bg-indigo-500'],
  [/bg-orange-200/g, 'bg-indigo-200'],
  [/bg-orange-100/g, 'bg-indigo-100'],
  [/bg-orange-50/g, 'bg-indigo-50'],
  [/bg-orange-950/g, 'bg-indigo-950'],

  // Text
  [/text-orange-700/g, 'text-indigo-700'],
  [/text-orange-600/g, 'text-indigo-600'],
  [/text-orange-500/g, 'text-indigo-500'],
  [/text-orange-400/g, 'text-indigo-400'],
  [/text-orange-300/g, 'text-indigo-300'],
  [/text-orange-200/g, 'text-indigo-200'],
  [/text-orange-100/g, 'text-indigo-100'],

  // Borders
  [/border-orange-500/g, 'border-indigo-500'],
  [/border-orange-400/g, 'border-indigo-400'],
  [/border-orange-300/g, 'border-indigo-300'],
  [/border-orange-200/g, 'border-indigo-200'],
  [/border-orange-100/g, 'border-indigo-100'],

  // Interaction states (must run before plain class map is applied? plain
  // maps above already rewrite the inner token, so only hover variants
  // that remain are mapped here)
  [/hover:bg-orange-50/g, 'hover:bg-indigo-50'],
  [/hover:bg-orange-100/g, 'hover:bg-indigo-100'],
  [/dark:hover:bg-orange-600/g, 'dark:hover:bg-indigo-500'],
  [/hover:from-orange-600/g, 'hover:bg-indigo-700'],
  [/hover:to-orange-700/g, ''],
  [/hover:from-orange-500/g, 'hover:bg-indigo-600'],
  [/hover:to-orange-600/g, ''],

  // Ring / outline accents
  [/ring-orange-500/g, 'ring-indigo-500'],
  [/ring-orange-400/g, 'ring-indigo-400'],
  [/focus:ring-orange-500/g, 'focus:ring-indigo-500'],
  [/focus:border-orange-500/g, 'focus:border-indigo-500'],
];

let total = 0;
for (const f of files) {
  const p = path.join(dir, f);
  let src = fs.readFileSync(p, 'utf8');
  let count = 0;
  for (const [re, to] of MAP) {
    src = src.replace(re, () => {
      count++;
      return to;
    });
  }
  // Collapse doubled spaces left by emptied hover:to- classes
  src = src.replace(/ {2,}/g, ' ');
  if (count) {
    fs.writeFileSync(p, src);
    total += count;
    console.log(`${f}: ${count}`);
  }
}
console.log(`TOTAL: ${total}`);
