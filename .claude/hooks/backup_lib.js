'use strict';
// Wspólna logika kopii przed zmianą (reguła RPDL) dla backup_hook.js i destructive_cmd_hook.js.
// Kopia: <katalog pliku>/archiwum/<nazwa>_vN.<ext> (N = najwyższe istniejące + 1),
// weryfikacja rozmiaru i SHA-256; gdy treść = ostatnia wersja w archiwum, kopia nie jest powielana.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadConfig } = require('./log-event');

function fileHash(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function backupConfig() {
  const b = loadConfig().backup || {};
  return {
    archiveDirName: b.archive_dir_name || 'archiwum',
    maxBytes: (b.max_file_mb || 200) * 1024 * 1024,
    maxMb: b.max_file_mb || 200,
    exclude: b.exclude_path_fragments || [],
  };
}

function isExcluded(absPath, fragments = backupConfig().exclude) {
  // Ukośnik na końcu: "…/node_modules" (sam katalog) też pasuje do fragmentu "/node_modules/".
  const norm = absPath.replace(/\\/g, '/').toLowerCase() + '/';
  return fragments.some(f => norm.includes(f.toLowerCase()));
}

// Zwraca { latestPath, nextPath } dla wzorca nazwa_vN.ext w katalogu archiwum.
function versionPaths(archiveDir, fileName) {
  const ext = path.extname(fileName);
  const base = ext ? fileName.slice(0, -ext.length) : fileName;
  const re = new RegExp(`^${escapeRe(base)}_v(\\d+)${escapeRe(ext)}$`, 'i');
  let max = 0;
  if (fs.existsSync(archiveDir)) {
    for (const name of fs.readdirSync(archiveDir)) {
      const m = name.match(re);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return {
    latestPath: max ? path.join(archiveDir, `${base}_v${max}${ext}`) : null,
    nextPath: path.join(archiveDir, `${base}_v${max + 1}${ext}`),
  };
}

// Kopia istniejącego pliku. Rzuca wyjątek przy każdym błędzie (wywołujący blokuje akcję).
function backupFile(absPath, cfg = backupConfig()) {
  const stat = fs.statSync(absPath);
  if (!stat.isFile()) throw new Error(`${absPath} nie jest plikiem`);
  if (stat.size > cfg.maxBytes) {
    const err = new Error(`plik ma ${(stat.size / 1048576).toFixed(0)} MB – powyżej limitu ${cfg.maxMb} MB`);
    err.code = 'TOO_LARGE';
    throw err;
  }
  const archiveDir = path.join(path.dirname(absPath), cfg.archiveDirName);
  const currentHash = fileHash(absPath);
  const { latestPath, nextPath } = versionPaths(archiveDir, path.basename(absPath));
  if (latestPath && fs.statSync(latestPath).size === stat.size && fileHash(latestPath) === currentHash) {
    return { backupPath: latestPath, reused: true, archiveDir };
  }
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.copyFileSync(absPath, nextPath, fs.constants.COPYFILE_EXCL);
  const copyStat = fs.statSync(nextPath);
  if (copyStat.size !== stat.size || fileHash(nextPath) !== currentHash) {
    throw new Error(`kopia niezgodna z oryginałem (${copyStat.size} B vs ${stat.size} B)`);
  }
  return { backupPath: nextPath, reused: false, archiveDir };
}

function toSlash(p) {
  return p.replace(/\\/g, '/');
}

module.exports = { backupFile, backupConfig, isExcluded, versionPaths, fileHash, toSlash };
