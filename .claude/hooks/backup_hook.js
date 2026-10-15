#!/usr/bin/env node
'use strict';
// Hook PreToolUse (Write | Edit | MultiEdit | NotebookEdit) – reguła RPDL „kopia przed zmianą".
// Przed zmianą istniejącego pliku kopiuje go do <katalog pliku>/archiwum/<nazwa>_vN.<ext>,
// sprawdza kopię (rozmiar + SHA-256) i zapisuje zdarzenie w rejestrze (log-event.js).
// Jeśli kopia lub wpis do rejestru się nie uda – blokuje narzędzie (fail-closed).
// Gdy plik jest identyczny z ostatnią wersją w archiwum, nie powiela kopii (wskazuje istniejącą).
// Logika kopii: backup_lib.js (wspólna z destructive_cmd_hook.js).
//
// Wyjście: brak wyjścia + exit 0 = przepuść do zwykłego toku uprawnień;
//          JSON permissionDecision deny/ask + exit 0 = decyzja; exit 2 + stderr = błąd hooka (blokada).

const fs = require('fs');
const path = require('path');
const { appendEvent } = require('./log-event');
const { backupFile, backupConfig, isExcluded, toSlash } = require('./backup_lib');

const TOOL_EVENT = { Write: 'file.overwrite', Edit: 'file.edit', MultiEdit: 'file.edit', NotebookEdit: 'notebook.edit' };

function decision(kind, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: kind, permissionDecisionReason: reason },
  }));
  process.exit(0);
}

function main() {
  const data = JSON.parse(fs.readFileSync(0, 'utf8'));
  const toolName = data.tool_name || '';
  const input = data.tool_input || {};
  const target = input.file_path || input.notebook_path;
  if (!TOOL_EVENT[toolName] || !target) process.exit(0);

  const cfg = backupConfig();
  const absPath = path.resolve(data.cwd || process.cwd(), target);
  if (isExcluded(absPath, cfg.exclude)) process.exit(0);

  const base = { session: data.session_id || null, object: toSlash(absPath) };

  // Nowy plik – nic do zachowania; rejestrujemy utworzenie (bez blokady, bo nic nie ginie).
  if (!fs.existsSync(absPath)) {
    try {
      appendEvent({ ...base, type: 'file.create', result: 'intent', reason: `${toolName}: nowy plik` });
    } catch (err) {
      process.stderr.write(`[RPDL] Ostrzeżenie: nie zapisano wpisu o utworzeniu pliku: ${err.message}\n`);
    }
    process.exit(0);
  }
  if (!fs.statSync(absPath).isFile()) process.exit(0);

  let result;
  try {
    result = backupFile(absPath, cfg);
  } catch (err) {
    const tooLarge = err.code === 'TOO_LARGE';
    try {
      appendEvent({ ...base, type: TOOL_EVENT[toolName], result: tooLarge ? 'ask' : 'deny', severity: tooLarge ? 'medium' : 'high', reason: `kopia nieudana: ${err.code || err.message}` });
    } catch { /* blokujemy / pytamy niezależnie od rejestru */ }
    if (tooLarge) decision('ask', `[RPDL] ${err.message} – brak automatycznej kopii. Zrób kopię ręcznie albo zatwierdź zmianę bez kopii.`);
    decision('deny', `[RPDL] Nie udało się zrobić kopii ${path.basename(absPath)} do archiwum: ${err.message}. Zmiana zablokowana – zrób kopię ręcznie i spróbuj ponownie.`);
  }

  try {
    appendEvent({
      ...base,
      type: TOOL_EVENT[toolName],
      result: 'intent',
      reason: result.reused ? `${toolName}; kopia identyczna już istnieje` : `${toolName}; kopia przed zmianą`,
      backup: toSlash(result.backupPath),
    });
  } catch (err) {
    decision('deny', `[EVENTLOG] Rejestr zdarzeń niedostępny (${err.message}). Kopia jest w ${result.backupPath}, ale zmiana została wstrzymana (fail-closed). Sprawdź: node "${path.join(__dirname, 'log-event.js')}" verify`);
  }
  process.stderr.write(`[RPDL] Kopia: ${result.backupPath}\n`);
  process.exit(0);
}

try {
  main();
} catch (err) {
  process.stderr.write(`[RPDL] Błąd hooka kopii (fail-closed, zmiana zablokowana): ${err.message}\n`);
  process.exit(2);
}
