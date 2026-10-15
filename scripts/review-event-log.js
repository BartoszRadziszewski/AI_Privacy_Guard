#!/usr/bin/env node
'use strict';
// Okresowy przegląd rejestru zdarzeń (reguła EVENTLOG, etap 9 planu naprawy).
//
// 1. Weryfikuje integralność łańcucha (log-event.js verify).
// 2. Szuka anomalii w oknie czasu (domyślnie 7 dni):
//    - usunięcia (zdarzenia *.delete),
//    - zmiany bez kopii (overwrite/edit/move/delete z result=intent i bez backup),
//    - kopie, których już nie ma na dysku (ktoś usunął archiwum),
//    - zdarzenia poza godzinami pracy i w weekendy,
//    - powtarzające się blokady/pytania (deny/ask ≥ 3 dla tego samego typu i obiektu),
//    - użycia furtki BIELIK_GUARD_BYPASS (guard.bypass),
//    - wpisy spóźnione (late) i korekty (corrects), cofnięcia czasu między kolejnymi wpisami,
//    - pierwsze wystąpienia typów zdarzeń (do weryfikacji wg EVENTLOG).
// 3. Zapisuje raport Markdown do logs/raporty/przeglad-RRRR-MM-DD[-N].md (nigdy nie nadpisuje)
//    i wypisuje podsumowanie. Raport zawiera tylko ścieżki i typy – bez treści.
//
// Użycie: node scripts/review-event-log.js [--days 7] [--log ścieżka] [--no-report]
// Kod wyjścia: 0 = łańcuch spójny (anomalie są w raporcie), 1 = łańcuch naruszony, 2 = błąd skryptu.
// Konfiguracja (opcjonalna) w config/governance.json:
//   "review": { "work_start_hour": 7, "work_end_hour": 19, "repeat_threshold": 3 }

const fs = require('fs');
const path = require('path');
const { verifyIntegrity, logPath, loadConfig } = require('../.claude/hooks/log-event');

const CHANGE_TYPES = /^(file\.(overwrite|edit|delete)|notebook\.edit|cmd\.(overwrite|delete|move))$/;

function parseArgs(argv) {
  const opts = { days: 7, log: null, report: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days') opts.days = parseFloat(argv[++i]);
    else if (argv[i] === '--log') opts.log = argv[++i];
    else if (argv[i] === '--no-report') opts.report = false;
  }
  return opts;
}

function readRecords(file) {
  if (!fs.existsSync(file)) return [];
  // Niepoprawne wiersze są pomijane – ich wykrycie raportuje część „Integralność".
  const out = [];
  for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    try { out.push(JSON.parse(l)); } catch { /* zgłoszone przez verify */ }
  }
  return out;
}

function localStamp(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function review(records, opts, cfg) {
  const rc = Object.assign({ work_start_hour: 7, work_end_hour: 19, repeat_threshold: 3 }, cfg.review || {});
  const since = Date.now() - opts.days * 86400000;
  const recent = records.filter(r => Date.parse(r.ts) >= since);
  const a = {
    deletions: [], noBackup: [], missingBackup: [], offHours: [], repeated: [],
    bypass: [], late: [], corrections: [], timeTravel: [], firstOccurrence: [],
  };
  let prevTs = null;
  for (const r of records) {
    const t = Date.parse(r.ts);
    if (prevTs !== null && t < prevTs && t >= since) a.timeTravel.push(r);
    prevTs = t;
  }
  const blocks = new Map();
  for (const r of recent) {
    if (/delete/.test(r.type)) a.deletions.push(r);
    if (CHANGE_TYPES.test(r.type) && r.result === 'intent' && !r.backup) a.noBackup.push(r);
    if (r.backup && !fs.existsSync(r.backup)) a.missingBackup.push(r);
    const d = new Date(r.ts);
    const day = d.getDay();
    if (day === 0 || day === 6 || d.getHours() < rc.work_start_hour || d.getHours() >= rc.work_end_hour) a.offHours.push(r);
    if (r.result === 'deny' || r.result === 'ask') {
      const key = `${r.type} | ${r.object}`;
      blocks.set(key, (blocks.get(key) || []).concat(r));
    }
    if (r.type === 'guard.bypass') a.bypass.push(r);
    if (r.late) a.late.push(r);
    if (r.corrects) a.corrections.push(r);
    if (r.first_occurrence) a.firstOccurrence.push(r);
  }
  for (const [key, list] of blocks) {
    if (list.length >= rc.repeat_threshold) a.repeated.push({ key, count: list.length, last: list[list.length - 1] });
  }
  return { recent, anomalies: a, rc };
}

function row(r) {
  return `| ${r.seq} | ${localStamp(r.ts)} | ${r.type} | ${r.result} | \`${r.object}\` | ${r.backup ? `\`${r.backup}\`` : '–'} |`;
}

function table(list, limit = 50) {
  if (!list.length) return '_brak_\n';
  const head = '| seq | czas (lokalny) | typ | wynik | obiekt | kopia |\n|---|---|---|---|---|---|\n';
  const more = list.length > limit ? `\n… i ${list.length - limit} kolejnych\n` : '';
  return head + list.slice(0, limit).map(row).join('\n') + '\n' + more;
}

function buildReport(file, integrity, res, opts) {
  const a = res.anomalies;
  const lines = [];
  lines.push(`# Przegląd rejestru zdarzeń – ${localStamp(new Date().toISOString())}`, '');
  lines.push(`Rejestr: \`${file.replace(/\\/g, '/')}\` · okno: ${opts.days} dni · wpisów w oknie: ${res.recent.length}`, '');
  lines.push('## Integralność', '');
  lines.push(integrity.ok ? `✅ ${integrity.message}` : `❌ **Łańcuch naruszony** – wiersz ${integrity.brokenAt}: ${integrity.reason}. To incydent – nie naprawiaj rejestru, zgłoś właścicielowi.`, '');
  lines.push('## Podsumowanie anomalii', '');
  lines.push('| Kontrola | Liczba |', '|---|---|');
  const summary = [
    ['Usunięcia', a.deletions.length],
    ['Zmiany bez kopii', a.noBackup.length],
    ['Kopie, których nie ma już na dysku', a.missingBackup.length],
    [`Poza godzinami pracy (${res.rc.work_start_hour}–${res.rc.work_end_hour}, pn–pt)`, a.offHours.length],
    [`Powtarzające się blokady/pytania (≥ ${res.rc.repeat_threshold})`, a.repeated.length],
    ['Użycia BIELIK_GUARD_BYPASS', a.bypass.length],
    ['Wpisy spóźnione / korekty', `${a.late.length} / ${a.corrections.length}`],
    ['Cofnięcia czasu między wpisami', a.timeTravel.length],
    ['Pierwsze wystąpienia (do weryfikacji)', a.firstOccurrence.length],
  ];
  for (const [k, v] of summary) lines.push(`| ${k} | ${v} |`);
  lines.push('');
  const sections = [
    ['Usunięcia', a.deletions], ['Zmiany bez kopii', a.noBackup], ['Kopie, których nie ma już na dysku', a.missingBackup],
    ['Użycia BIELIK_GUARD_BYPASS', a.bypass], ['Cofnięcia czasu', a.timeTravel], ['Wpisy spóźnione', a.late],
    ['Korekty', a.corrections], ['Poza godzinami pracy', a.offHours], ['Pierwsze wystąpienia', a.firstOccurrence],
  ];
  for (const [title, list] of sections) {
    lines.push(`## ${title}`, '', table(list));
  }
  lines.push('## Powtarzające się blokady/pytania', '');
  if (!a.repeated.length) lines.push('_brak_', '');
  else {
    lines.push('| typ \\| obiekt | liczba | ostatnio |', '|---|---|---|');
    for (const r of a.repeated) lines.push(`| \`${r.key}\` | ${r.count} | ${localStamp(r.last.ts)} |`);
    lines.push('');
  }
  return lines.join('\n');
}

function reportPath(file) {
  const dir = path.join(path.dirname(file), 'raporty');
  fs.mkdirSync(dir, { recursive: true });
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const base = `przeglad-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  let p = path.join(dir, `${base}.md`);
  for (let n = 2; fs.existsSync(p); n++) p = path.join(dir, `${base}-${n}.md`); // bez nadpisywania
  return p;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const file = opts.log || logPath();
  const integrity = verifyIntegrity(file);
  const records = readRecords(file);
  const res = review(records, opts, loadConfig());
  const report = buildReport(file, integrity, res, opts);
  if (opts.report) {
    const out = reportPath(file);
    fs.writeFileSync(out, report, 'utf8');
    process.stdout.write(`Raport: ${out}\n`);
  }
  const a = res.anomalies;
  process.stdout.write(
    `Integralność: ${integrity.ok ? 'OK' : 'NARUSZONA'} | wpisy w oknie: ${res.recent.length} | usunięcia: ${a.deletions.length} | ` +
    `bez kopii: ${a.noBackup.length} | brak plików kopii: ${a.missingBackup.length} | poza godzinami: ${a.offHours.length} | ` +
    `powtórzone blokady: ${a.repeated.length} | furtka: ${a.bypass.length} | pierwsze wystąpienia: ${a.firstOccurrence.length}\n`,
  );
  return integrity.ok ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (err) {
    process.stderr.write(`[review-event-log] Błąd: ${err.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = { review, buildReport };
