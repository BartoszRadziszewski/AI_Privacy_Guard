// Parser plików kontekstu (Moduł A). PDF / DOCX / TXT / MD → czysty tekst.
import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
// Import bezpośrednio z lib/ — główny plik pdf-parse ma feler pakietowania (tryb debug w ESM).
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md']);

export function isSupportedFile(filename) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

/**
 * @param {string} filePath ścieżka pliku tymczasowego
 * @param {string} originalName oryginalna nazwa pliku (dla rozszerzenia)
 * @returns {Promise<string>} wyekstrahowany tekst
 */
export async function parseDocument(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  switch (ext) {
    case '.pdf': {
      const buffer = await fs.readFile(filePath);
      const result = await pdfParse(buffer);
      return result.text ?? '';
    }
    case '.docx': {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value ?? '';
    }
    case '.txt':
    case '.md':
      return fs.readFile(filePath, 'utf-8');
    default:
      throw new Error(`Nieobsługiwany typ pliku: ${ext}`);
  }
}

/**
 * Przycina bufor kontekstu do limitu znaków, z adnotacją o przycięciu.
 */
export function clampContext(text, limit) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[UWAGA: materiał źródłowy przycięto do ${limit} znaków]`;
}
