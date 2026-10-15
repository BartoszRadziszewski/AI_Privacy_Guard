#!/usr/bin/env node
'use strict';
// Hook PreToolUse (Bash | PowerShell) – reguła RPDL dla poleceń niszczących (etap 4, faza 2).
//
// Rozpoznaje polecenia, które usuwają, przenoszą lub nadpisują pliki:
//   usunięcie:   rm, rmdir, unlink, del, erase, rd, Remove-Item (ri)
//   przeniesienie / zmiana nazwy: mv, move, ren, Move-Item (mi), Rename-Item (rni)
//   nadpisanie:  cp/copy/Copy-Item na istniejący plik, przekierowanie > (nie >>),
//                Set-Content, Out-File (bez -Append), sed -i, perl -i
//   git:         reset --hard, clean, checkout -- <ścieżki> / checkout ., restore (bez --staged),
//                stash drop|clear, branch -D, push --force
//   inne:        find … -delete / -exec rm, xargs rm
// Dla zwykłych plików robi kopię archiwum/nazwa_vN.ext (backup_lib.js) i wpis do rejestru,
// po czym przepuszcza polecenie do zwykłego toku uprawnień.
// Pyta człowieka (ask), gdy celu nie da się ustalić lub zabezpieczyć: katalogi, wzorce (*),
// zmienne ($x), podstawienia, operacje git, find/xargs, pliki ponad limit.
// Blokuje (deny), gdy kopia się nie uda albo rejestr jest niedostępny. Błąd hooka = exit 2.
//
// Ograniczenie: wykrywanie jest heurystyczne – skrypty (python/node), które same zapisują
// lub usuwają pliki, oraz polecenia budowane dynamicznie nie są widoczne dla hooka.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { appendEvent } = require('./log-event');
const { backupFile, backupConfig, isExcluded, toSlash } = require('./backup_lib');

// ── Tokenizacja ────────────────────────────────────────────────────────────────

const SEPARATORS = new Set(['&&', '||', ';', '|', '\n', '&']);

function tokenize(cmd) {
  const tokens = [];
  let i = 0;
  while (i < cmd.length) {
    const ch = cmd[i];
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }
    if (ch === '\\' && cmd[i + 1] === '\n') { i += 2; continue; } // kontynuacja wiersza
    const three = cmd.slice(i, i + 3);
    const two = cmd.slice(i, i + 2);
    if (['2>>', '&>>'].includes(three)) { tokens.push({ op: three }); i += 3; continue; }
    if (['&&', '||', '>>', '>|', '2>', '&>', '1>'].includes(two)) { tokens.push({ op: two }); i += 2; continue; }
    if ([';', '|', '\n', '>', '<', '&'].includes(ch)) { tokens.push({ op: ch }); i++; continue; }
    // słowo (z cudzysłowami)
    let v = '';
    let dynamic = false;
    while (i < cmd.length && !/[\s;|&<>]/.test(cmd[i])) {
      const c = cmd[i];
      if (c === "'" || c === '"') {
        const end = cmd.indexOf(c, i + 1);
        const inner = end === -1 ? cmd.slice(i + 1) : cmd.slice(i + 1, end);
        if (c === '"' && /[$`]/.test(inner)) dynamic = true;
        v += inner;
        i = end === -1 ? cmd.length : end + 1;
        continue;
      }
      if (c === '\\' && i + 1 < cmd.length) { v += cmd[i + 1]; i += 2; continue; }
      if (/[*?$`]/.test(c) || (c === '[' && /\]/.test(cmd.slice(i)))) dynamic = true;
      if (c === '(' || c === ')' || c === '{' || c === '}') dynamic = true;
      v += c;
      i++;
    }
    tokens.push({ word: v, dynamic });
  }
  return tokens;
}

// Dzieli na polecenia; każde = { words: [{word,dynamic}], redirects: [{op, target}] }
function segments(tokens) {
  const out = [];
  let cur = { words: [], redirects: [] };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.op && SEPARATORS.has(t.op)) {
      if (cur.words.length || cur.redirects.length) out.push(cur);
      cur = { words: [], redirects: [] };
    } else if (t.op) {
      const next = tokens[i + 1];
      if (next && next.word !== undefined) {
        cur.redirects.push({ op: t.op, target: next });
        i++;
      }
    } else {
      cur.words.push(t);
    }
  }
  if (cur.words.length || cur.redirects.length) out.push(cur);
  return out;
}

// ── Ścieżki ───────────────────────────────────────────────────────────────────

const NULL_TARGETS = new Set(['/dev/null', 'nul', '$null', 'null']);

function toWinPath(p) {
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(1));
  const m = p.match(/^\/([a-zA-Z])(\/.*)?$/); // Git Bash: /c/work -> C:/work
  if (m && process.platform === 'win32') return `${m[1].toUpperCase()}:${m[2] || '/'}`;
  return p;
}

function resolvePath(cwd, p) {
  return path.resolve(cwd, toWinPath(p));
}

// ── Parsowanie argumentów ─────────────────────────────────────────────────────

const PS_VALUE_PARAMS = new Set([
  '-path', '-literalpath', '-destination', '-filepath', '-filter', '-include', '-exclude',
  '-encoding', '-value', '-inputobject', '-credential', '-stream', '-width', '-newname', '-pspath',
]);

// Zwraca { positional: [tok], params: {name: tok|true} }
function parseArgs(words, isPs) {
  const positional = [];
  const params = {};
  let endOpts = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const v = w.word;
    if (!endOpts && v === '--' && !isPs) { endOpts = true; continue; }
    if (!endOpts && v.startsWith('-') && v.length > 1) {
      const name = v.toLowerCase().split(':')[0];
      if (isPs && PS_VALUE_PARAMS.has(name) && i + 1 < words.length) {
        params[name] = words[++i];
      } else {
        params[name] = true;
      }
      continue;
    }
    positional.push(w);
  }
  return { positional, params };
}

// PowerShell: "a.txt,b.txt" jako lista ścieżek
function splitPsList(tok) {
  return tok.word.split(',').filter(Boolean).map(word => ({ word, dynamic: tok.dynamic }));
}

// ── Klasyfikacja poleceń ──────────────────────────────────────────────────────

const DELETE = new Set(['rm', 'rmdir', 'unlink', 'del', 'erase', 'rd', 'remove-item', 'ri', 'shred']);
const MOVE = new Set(['mv', 'move', 'move-item', 'mi', 'ren', 'rename', 'rename-item', 'rni']);
const COPY = new Set(['cp', 'copy', 'copy-item', 'cpi']);
const WRITE = new Set(['set-content', 'sc', 'out-file']);

// Zwraca listę działań: { kind: 'file'|'ask', action, tok?, reason? }
function analyze(seg, isPs, state) {
  const actions = [];
  const words = seg.words.slice();
  // pomijamy przypisania zmiennych i sudo
  while (words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0].word) || words[0].word === 'sudo')) words.shift();

  // przekierowania nadpisujące
  for (const r of seg.redirects) {
    if (!['>', '>|', '1>', '&>'].includes(r.op)) continue;
    if (NULL_TARGETS.has(r.target.word.toLowerCase())) continue;
    actions.push({ kind: 'file', action: 'cmd.overwrite', tok: r.target, label: `przekierowanie ${r.op}` });
  }
  if (!words.length) return actions;

  const verb = words[0].word.toLowerCase().replace(/\.exe$/, '').replace(/^.*[\\/]/, '');
  const args = words.slice(1);
  const { positional, params } = parseArgs(args, isPs);
  const isPsVerb = verb.includes('-') || isPs;

  if (verb === 'cd' || verb === 'set-location' || verb === 'sl' || verb === 'pushd' || verb === 'chdir') {
    const target = positional[0] || (params['-path'] !== true ? params['-path'] : undefined);
    if (!target) state.cwd = os.homedir();
    else if (target.dynamic) state.cwdUnknown = true;
    else state.cwd = resolvePath(state.cwd, target.word);
    return actions;
  }

  if (DELETE.has(verb)) {
    let targets = positional;
    for (const p of ['-path', '-literalpath']) if (params[p] && params[p] !== true) targets = targets.concat([params[p]]);
    if (isPsVerb) targets = targets.flatMap(splitPsList);
    if (params['-filter'] || params['-include'] || params['-exclude']) {
      actions.push({ kind: 'ask', reason: `${verb} z filtrem (-Filter/-Include/-Exclude)` });
    }
    for (const t of targets) actions.push({ kind: 'file', action: 'cmd.delete', tok: t, label: verb, dirAsk: true });
    return actions;
  }

  if (MOVE.has(verb) || COPY.has(verb)) {
    const isMove = MOVE.has(verb);
    let srcs = positional.slice();
    let dest = params['-destination'] && params['-destination'] !== true ? params['-destination'] : null;
    if (params['-path'] && params['-path'] !== true) srcs.unshift(params['-path']);
    if (params['-literalpath'] && params['-literalpath'] !== true) srcs.unshift(params['-literalpath']);
    if (!dest && srcs.length >= 2) dest = srcs.pop();
    if (params['-newname'] && params['-newname'] !== true) dest = params['-newname'];
    if (isMove) {
      for (const s of srcs) actions.push({ kind: 'file', action: 'cmd.move', tok: s, label: verb, dirAsk: true });
    }
    if (dest) {
      // cel nadpisywany tylko gdy istnieje jako plik; przy katalogu docelowym – plik o nazwie źródła
      actions.push({ kind: 'dest', action: 'cmd.overwrite', tok: dest, srcs, label: `${verb} (cel)` });
    }
    return actions;
  }

  if (WRITE.has(verb) && !params['-append'] && !params['-noclobber']) {
    const target = params['-filepath'] || params['-path'] || params['-literalpath'] || positional[0];
    if (target && target !== true) actions.push({ kind: 'file', action: 'cmd.overwrite', tok: target, label: verb });
    else actions.push({ kind: 'ask', reason: `${verb} bez rozpoznanej ścieżki` });
    return actions;
  }

  if ((verb === 'sed' || verb === 'perl') && Object.keys(params).some(p => /^-i/.test(p) || p === '--in-place' || /^-[a-z]*i/.test(p))) {
    let files = positional;
    if (!params['-e'] && !params['-f'] && !params['--expression']) files = files.slice(1); // pierwszy = skrypt
    for (const f of files) actions.push({ kind: 'file', action: 'cmd.overwrite', tok: f, label: `${verb} -i` });
    return actions;
  }

  if (verb === 'git') {
    const rest = args.map(a => a.word);
    // podpolecenie = pierwsze znane słowo (pomija np. "-C <katalog>", "-c key=value")
    const sub = rest.find(a => ['reset', 'clean', 'checkout', 'restore', 'stash', 'branch', 'push', 'commit', 'status', 'log', 'diff', 'add', 'pull', 'fetch', 'merge', 'rebase'].includes(a.toLowerCase())) || '';
    const has = f => rest.includes(f);
    let reason = null;
    if (sub === 'reset' && has('--hard')) reason = 'git reset --hard (utrata niezatwierdzonych zmian)';
    else if (sub === 'clean' && rest.some(a => /^-[a-zA-Z]*f/.test(a) || a === '--force')) reason = 'git clean (usunięcie nieśledzonych plików)';
    else if (sub === 'checkout' && (has('--') || has('.'))) reason = 'git checkout -- / . (odrzucenie zmian w plikach)';
    else if (sub === 'restore' && !has('--staged') && !has('-S')) reason = 'git restore (odrzucenie zmian w plikach)';
    else if (sub === 'stash' && (has('drop') || has('clear'))) reason = 'git stash drop/clear';
    else if (sub === 'branch' && (has('-D') || (has('-d') && has('--force')))) reason = 'git branch -D (usunięcie gałęzi)';
    else if (sub === 'push' && rest.some(a => a === '--force' || a === '-f' || a.startsWith('--force-with-lease') || /^\+/.test(a))) reason = 'git push --force (nadpisanie historii zdalnej)';
    if (reason) actions.push({ kind: 'ask', reason });
    return actions;
  }

  if (verb === 'find' && args.some(a => a.word === '-delete' || a.word === '-exec' || a.word === '-execdir')) {
    actions.push({ kind: 'ask', reason: 'find z -delete/-exec' });
    return actions;
  }
  if (verb === 'xargs' && args.some(a => DELETE.has(a.word.toLowerCase()) || MOVE.has(a.word.toLowerCase()))) {
    actions.push({ kind: 'ask', reason: 'xargs z usuwaniem/przenoszeniem' });
  }
  return actions;
}

// ── Główna logika ─────────────────────────────────────────────────────────────

function decision(kind, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: kind, permissionDecisionReason: reason },
  }));
  process.exit(0);
}

function main() {
  const data = JSON.parse(fs.readFileSync(0, 'utf8'));
  const tool = data.tool_name || '';
  if (tool !== 'Bash' && tool !== 'PowerShell') process.exit(0);
  const command = (data.tool_input && data.tool_input.command) || '';
  const isPs = tool === 'PowerShell';
  const cfg = backupConfig();
  const state = { cwd: data.cwd || process.cwd(), cwdUnknown: false };
  const session = data.session_id || null;

  const asks = [];
  const backups = []; // { object, action, backup, reused }
  const denies = [];

  for (const seg of segments(tokenize(command))) {
    for (const act of analyze(seg, isPs, state)) {
      if (act.kind === 'ask') { asks.push(act.reason); continue; }
      const tok = act.tok;
      if (!tok || tok.dynamic) { asks.push(`${act.label}: ścieżka ze zmienną lub wzorcem (${tok ? tok.word : '?'})`); continue; }
      if (state.cwdUnknown && !path.isAbsolute(toWinPath(tok.word))) { asks.push(`${act.label}: nieustalony katalog roboczy (cd ze zmienną)`); continue; }
      let abs = resolvePath(state.cwd, tok.word);
      if (act.kind === 'dest' && fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
        // kopiowanie/przenoszenie do katalogu: nadpisywane są pliki o nazwach źródeł
        for (const s of act.srcs) {
          if (s.dynamic) { asks.push(`${act.label}: źródło ze wzorcem (${s.word})`); continue; }
          const candidate = path.join(abs, path.basename(toWinPath(s.word)));
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) protect(candidate, act);
        }
        continue;
      }
      if (isExcluded(abs, cfg.exclude) || !fs.existsSync(abs)) continue; // nic do stracenia
      const st = fs.statSync(abs);
      if (st.isDirectory()) {
        if (act.dirAsk) asks.push(`${act.label}: katalog ${toSlash(abs)} (bez automatycznej kopii)`);
        continue;
      }
      protect(abs, act);
    }
  }

  function protect(abs, act) {
    if (isExcluded(abs, cfg.exclude)) return;
    try {
      const r = backupFile(abs, cfg);
      backups.push({ object: toSlash(abs), action: act.action, backup: toSlash(r.backupPath), reused: r.reused });
    } catch (err) {
      if (err.code === 'TOO_LARGE') asks.push(`${act.label}: ${toSlash(abs)} – ${err.message}`);
      else denies.push(`${toSlash(abs)}: ${err.message}`);
    }
  }

  if (!asks.length && !backups.length && !denies.length) process.exit(0); // nic niszczącego

  let logError = null;
  try {
    for (const b of backups) {
      appendEvent({ session, type: b.action, object: b.object, result: denies.length ? 'deny' : asks.length ? 'ask' : 'intent', backup: b.backup, reason: `${tool}: ${b.reused ? 'kopia identyczna już istnieje' : 'kopia przed poleceniem'}` });
    }
    if (asks.length || denies.length) {
      appendEvent({ session, type: 'cmd.destructive', object: `${tool.toLowerCase()}:${toSlash(state.cwd)}`, result: denies.length ? 'deny' : 'ask', severity: denies.length ? 'high' : 'medium', reason: [...denies, ...asks].join('; ').slice(0, 500) });
    }
  } catch (err) {
    logError = err.message;
  }

  const backupList = backups.map(b => `${b.object} -> ${b.backup}`).join('\n');
  if (denies.length) {
    decision('deny', `[RPDL] Nie udało się zrobić kopii przed poleceniem: ${denies.join('; ')}. Polecenie zablokowane – zrób kopię ręcznie.`);
  }
  if (logError) {
    decision('deny', `[EVENTLOG] Rejestr zdarzeń niedostępny (${logError}). Polecenie niszczące wstrzymane (fail-closed).`);
  }
  if (asks.length) {
    decision('ask', `[RPDL] Polecenie może usunąć lub nadpisać dane, których hook nie zabezpieczy automatycznie:\n- ${asks.join('\n- ')}${backupList ? `\nZrobione kopie:\n${backupList}` : ''}\nZatwierdź tylko, jeśli kopia istnieje albo dane są zbędne.`);
  }
  process.stderr.write(`[RPDL] Kopie przed poleceniem:\n${backupList}\n`);
  process.exit(0);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[RPDL] Błąd hooka poleceń niszczących (fail-closed, polecenie zablokowane): ${err.message}\n`);
    process.exit(2);
  }
}

module.exports = { tokenize, segments, analyze };
