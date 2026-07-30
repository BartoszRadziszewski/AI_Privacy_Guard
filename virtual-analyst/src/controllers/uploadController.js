// Upload plików kontekstu (Moduł A): walidacja typu i rozmiaru, parsowanie,
// dopisanie do bufora kontekstu z limitem znaków.
import fs from 'node:fs/promises';
import { isSupportedFile, parseDocument, clampContext } from '../services/documentParser.js';
import { appendContextBuffer, setContextBuffer, getContextBuffer } from './sessionController.js';
import { logger } from '../utils/logger.js';

export function makeUploadHandler(config) {
  const limit = config.limits?.contextBufferChars ?? 60000;

  return async function handleUpload(req, res) {
    const file = req.file;
    try {
      if (!file) {
        return res.status(400).json({ error: 'Nie przesłano pliku' });
      }
      if (!isSupportedFile(file.originalname)) {
        return res
          .status(415)
          .json({ error: 'Nieobsługiwany typ pliku (dozwolone: pdf, docx, txt, md)' });
      }

      const text = await parseDocument(file.path, file.originalname);
      const labelled = `=== Plik: ${file.originalname} ===\n${text.trim()}`;
      const combined = clampContext(appendContextBuffer(labelled), limit);
      setContextBuffer(combined);

      logger.info('upload: dodano plik do kontekstu', {
        file: file.originalname,
        chars: text.length,
      });
      res.json({
        ok: true,
        file: file.originalname,
        extractedChars: text.length,
        contextChars: getContextBuffer().length,
      });
    } catch (error) {
      logger.error('upload: błąd parsowania', { message: error.message });
      res.status(500).json({ error: 'Nie udało się przetworzyć pliku' });
    } finally {
      if (file?.path) await fs.unlink(file.path).catch(() => {});
    }
  };
}

export function makeManualContextHandler(config) {
  const limit = config.limits?.contextBufferChars ?? 60000;

  return function handleManualContext(req, res) {
    const description = String(req.body?.description ?? '').trim();
    if (!description) {
      return res.status(400).json({ error: 'Puste pole opisu' });
    }
    const combined = clampContext(
      appendContextBuffer(`=== Opis organizacji (wpisany ręcznie) ===\n${description}`),
      limit
    );
    setContextBuffer(combined);
    res.json({ ok: true, contextChars: getContextBuffer().length });
  };
}

export function handleContextReset(_req, res) {
  setContextBuffer('');
  res.json({ ok: true, contextChars: 0 });
}
