#!/usr/bin/env node
'use strict';
// Rejestr zdarzeń (reguła EVENTLOG) – append-only JSON Lines z łańcuchem SHA-256.
// Oparty na wewnętrznym module audytu (append-only JSONL z łańcuchem SHA-256):
//   hash_n = SHA-256( canonicalJSON(rekord_n bez pola hash) + prev_hash )
// Różnice: pełny schemat pól reguły, numer seq, blokada pliku między procesami
// (hooki z równoległych sesji), zapis synchroniczny i fail-closed (błąd = wyjątek / exit 1).
//
// CLI:
//   node log-event.js append '<json>'      (albo JSON na stdin)  -> wypisuje zapisany rekord
//   node log-event.js verify               -> exit 0 gdy łańcuch spójny, 1 gdy nie
//   node log-event.js tail [n]             -> ostatnie n wpisów (domyślnie 10)
// Ścieżka rejestru: env EVENT_LOG_PATH > config/governance.json (event_log_path) > logs/events.jsonl

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GENESIS_HASH = '0'.repeat(64);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'governance.json');
const LOCK_TIMEOUT_MS = 5000;
const LOCK_STALE_MS = 15000;
const TAIL_BYTES = 256 * 1024;

const RESULTS = new Set(['intent', 'success', 'deny', 'ask', 'error']);
const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function logPath() {
  return process.env.EVENT_LOG_PATH || loadConfig().event_log_path || path.join(PROJECT_ROOT, 'logs', 'events.jsonl');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function computeHash(recordWithoutHash) {
  return sha256(canonicalJson(recordWithoutHash) + recordWithoutHash.prev_hash);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Blokada międzyprocesowa: plik .lock tworzony atomowo (flaga wx).
function withLock(file, fn) {
  const lock = `${file}.lock`;
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let fd;
  for (;;) {
    try {
      fd = fs.openSync(lock, 'wx');
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) {
          fs.unlinkSync(lock); // właściciel blokady padł; ewentualny urwany wpis wykryje verify
          continue;
        }
      } catch { /* blokada zniknęła w międzyczasie */ }
      if (Date.now() > deadline) throw new Error(`Nie uzyskano blokady rejestru w ${LOCK_TIMEOUT_MS} ms (${lock})`);
      sleep(25);
    }
  }
  try {
    return fn();
  } finally {
    fs.closeSync(fd);
    try { fs.unlinkSync(lock); } catch { /* ignore */ }
  }
}

// Ostatni wpis bez czytania całego pliku. Urwany ostatni wiersz = błąd (fail-closed).
function readLastRecord(file) {
  if (!fs.existsSync(file)) return null;
  const size = fs.statSync(file).size;
  if (size === 0) return null;
  const len = Math.min(size, TAIL_BYTES);
  const buf = Buffer.alloc(len);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, buf, 0, len, size - len);
  } finally {
    fs.closeSync(fd);
  }
  const text = buf.toString('utf8');
  if (!text.endsWith('\n')) throw new Error('Ostatni wpis rejestru jest urwany (brak końca wiersza). Uruchom: node log-event.js verify');
  const lines = text.split('\n').filter(l => l.trim());
  try {
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    throw new Error('Ostatni wpis rejestru nie jest poprawnym JSON. Uruchom: node log-event.js verify');
  }
}

// Indeks kluczy do wykrywania pierwszego wystąpienia (first_occurrence).
function keysPath(file) {
  return file.replace(/\.jsonl$/, '') + '.keys.json';
}

function loadKeys(file) {
  const kp = keysPath(file);
  if (fs.existsSync(kp)) return new Set(JSON.parse(fs.readFileSync(kp, 'utf8')));
  const keys = new Set();
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        keys.add(occurrenceKey(r.type, r.occurrence_key));
      } catch { /* verify zgłosi */ }
    }
  }
  return keys;
}

function occurrenceKey(type, key) {
  return `${type}|${key || ''}`;
}

function inferClient(objectPath) {
  const cfg = loadConfig();
  // Katalog projektów: zmienna BIELIK_GUARD_PROJECTS_ROOT > config projects_root; brak = bez etykiety klienta
  const root = (process.env.BIELIK_GUARD_PROJECTS_ROOT || cfg.projects_root || '').replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');
  const p = String(objectPath || '').replace(/\\/g, '/');
  if (!root || !p.toLowerCase().startsWith(root + '/')) return { client: null, confidentiality: cfg.default_confidentiality || 'nieokreślony' };
  const projectDir = p.slice(root.length + 1).split('/')[0];
  const client = projectDir.split(/[._]/)[0].toLowerCase();
  const map = cfg.confidentiality_by_client || {};
  return { client, confidentiality: map[client] || cfg.default_confidentiality || 'nieokreślony' };
}

// Zapisuje wpis. Rzuca wyjątek przy każdym błędzie – wywołujący ma wtedy wstrzymać akcję.
function appendEvent(input) {
  if (!input || typeof input !== 'object') throw new Error('Brak danych zdarzenia');
  for (const field of ['type', 'object', 'result']) {
    if (!input[field]) throw new Error(`Brak wymaganego pola: ${field}`);
  }
  if (!RESULTS.has(input.result)) throw new Error(`Niedozwolony result: ${input.result} (dozwolone: ${[...RESULTS].join(', ')})`);
  const severity = input.severity || 'info';
  if (!SEVERITIES.has(severity)) throw new Error(`Niedozwolony severity: ${severity}`);

  const file = logPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const inferred = inferClient(input.object);

  return withLock(file, () => {
    const last = readLastRecord(file);
    const keys = loadKeys(file);
    const okey = occurrenceKey(input.type, input.occurrence_key);
    const record = {
      seq: last ? last.seq + 1 : 1,
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      actor: input.actor || { type: 'agent', id: 'claude-code' },
      session: input.session || null,
      client: input.client !== undefined ? input.client : inferred.client,
      confidentiality: input.confidentiality || inferred.confidentiality,
      type: input.type,
      severity,
      object: input.object,
      result: input.result,
      reason: input.reason || null,
      backup: input.backup || null,
      consent: input.consent || null,
      first_occurrence: !keys.has(okey),
      occurrence_key: input.occurrence_key || undefined,
      corrects: input.corrects || undefined,
      late: input.late || undefined,
      event_ts: input.event_ts || undefined,
      prev_hash: last ? last.hash : GENESIS_HASH,
    };
    record.hash = computeHash(record);
    const line = JSON.stringify(record) + '\n';
    const fd = fs.openSync(file, 'a');
    try {
      fs.writeSync(fd, line);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    if (record.first_occurrence) {
      keys.add(okey);
      fs.writeFileSync(keysPath(file), JSON.stringify([...keys]), 'utf8');
    }
    return record;
  });
}

// Weryfikacja: JSON, ciągłość seq, prev_hash, hash. Wykrywa modyfikację, usunięcie i zmianę kolejności.
// Ograniczenie: usunięcia OSTATNICH wpisów sam łańcuch nie wykryje (brak kolejnego ogniwa).
function verifyIntegrity(file = logPath()) {
  if (!fs.existsSync(file)) return { ok: true, records: 0, message: 'Brak pliku rejestru (0 wpisów).' };
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.length && !raw.endsWith('\n')) return { ok: false, brokenAt: 'koniec pliku', reason: 'urwany ostatni wpis' };
  const lines = raw.split('\n').filter(l => l.trim());
  let prev = GENESIS_HASH;
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    let record;
    try {
      record = JSON.parse(lines[i]);
    } catch {
      return { ok: false, records: lines.length, brokenAt: lineNo, reason: 'niepoprawny JSON' };
    }
    if (record.seq !== lineNo) return { ok: false, records: lines.length, brokenAt: lineNo, reason: `luka w numeracji (seq=${record.seq}, oczekiwano ${lineNo})` };
    if (record.prev_hash !== prev) return { ok: false, records: lines.length, brokenAt: lineNo, reason: 'prev_hash nie pasuje do poprzedniego wpisu (usunięcie lub zmiana kolejności)' };
    const { hash, ...rest } = record;
    if (computeHash(rest) !== hash) return { ok: false, records: lines.length, brokenAt: lineNo, reason: 'hash nie pasuje do treści wpisu (modyfikacja)' };
    prev = hash;
  }
  return { ok: true, records: lines.length, message: `Łańcuch spójny (${lines.length} wpisów).`, file };
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main(argv) {
  const [cmd, arg] = argv;
  if (cmd === 'append') {
    const text = arg && arg !== '-' ? arg : readStdin();
    const record = appendEvent(JSON.parse(text));
    process.stdout.write(JSON.stringify(record) + '\n');
    return 0;
  }
  if (cmd === 'verify') {
    const res = verifyIntegrity(arg || logPath());
    process.stdout.write(JSON.stringify(res, null, 2) + '\n');
    return res.ok ? 0 : 1;
  }
  if (cmd === 'tail') {
    const n = parseInt(arg || '10', 10);
    const file = logPath();
    if (!fs.existsSync(file)) return 0;
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim());
    process.stdout.write(lines.slice(-n).join('\n') + '\n');
    return 0;
  }
  process.stderr.write('Użycie: node log-event.js append \'<json>\' | verify [ścieżka] | tail [n]\n');
  return 2;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`[log-event] BŁĄD (fail-closed): ${err.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { appendEvent, verifyIntegrity, logPath, loadConfig, inferClient, canonicalJson, sha256, GENESIS_HASH };
