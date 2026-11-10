// Chamada ao CLI do Tesseract (0.3.1) a partir do Node, sem depender do PATH.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const T = path.join(process.env.LOCALAPPDATA || '', 'Tesseract', 'bin', 'tsrct.cmd');
const tsrct = (...a) => execFileSync('cmd.exe', ['/c', T, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });

// lê o documento editável de um .tsrct (checkout) e devolve o JSON
function checkout(proj) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-co-'));
  const f = path.join(tmp, 'doc.json');
  try { tsrct('project', 'checkout', '-p', proj, '--output', f); return JSON.parse(fs.readFileSync(f, 'utf8')); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
function commit(proj, doc) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-ci-'));
  const f = path.join(tmp, 'doc.json');
  try { fs.writeFileSync(f, JSON.stringify(doc)); tsrct('project', 'commit', '-p', proj, '--file', f); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
function apply(proj, acoes) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-ap-'));
  const f = path.join(tmp, 'acoes.json');
  try { fs.writeFileSync(f, JSON.stringify(acoes)); return JSON.parse(tsrct('project', 'apply', '-p', proj, '--actions', f)); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
const preview = (proj, t, out) => tsrct('preview', '-p', proj, '-t', String(t), '-o', out);

module.exports = { T, tsrct, checkout, commit, apply, preview };
