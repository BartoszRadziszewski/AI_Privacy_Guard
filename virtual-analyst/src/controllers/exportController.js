// Moduł D: generator specyfikacji PIM. Osobne wywołanie LLM (buildSpecPrompt),
// eksport do .md / .json / .docx w katalogu exports/.
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateAnalystResponse } from '../services/llm/llmFactory.js';
import { buildSpecPrompt } from '../prompts/analystPrompts.js';
import { markdownToDocx } from '../services/pimDocxGenerator.js';
import { getSession, getContextBuffer } from './sessionController.js';
import { logger } from '../utils/logger.js';

// Parsuje Markdown na sekcje po nagłówkach ## — do eksportu JSON.
function markdownToSections(markdown) {
  const sections = [];
  let current = { title: 'Preambuła', content: [] };
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^##\s+(.*)$/);
    if (match) {
      if (current.content.length) sections.push({ ...current, content: current.content.join('\n').trim() });
      current = { title: match[1].trim(), content: [] };
    } else {
      current.content.push(line);
    }
  }
  if (current.content.length) sections.push({ ...current, content: current.content.join('\n').trim() });
  return sections;
}

export function makeExportHandler({ config, templates, exportsDir }) {
  return async function handleExport(req, res) {
    const { sessionId, provider } = req.body ?? {};
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Nieznana sesja wywiadu' });
    }
    if (!session.history.length) {
      return res.status(400).json({ error: 'Wywiad jest pusty — nie ma czego eksportować' });
    }

    const chosenProvider = provider || session.provider || config.defaultProvider;
    const providerConfig = config.providers[chosenProvider] ?? {};

    try {
      const transcript = session.history
        .map((m) => `${m.role === 'user' ? 'ROZMÓWCA' : 'ANALITYK'}: ${m.content}`)
        .join('\n');

      const systemPrompt = buildSpecPrompt(templates.specGenerationInstruction, getContextBuffer());
      logger.info('export: generuję specyfikację', {
        provider: chosenProvider,
        turns: session.history.length,
      });

      const markdown = await generateAnalystResponse(
        chosenProvider,
        [{ role: 'user', content: `Zapis wywiadu analitycznego:\n\n${transcript}` }],
        systemPrompt,
        {
          model: providerConfig.model,
          maxTokens: config.limits?.specMaxTokens ?? 16000,
          effort: providerConfig.specEffort ?? 'high',
        }
      );

      const generatedAt = new Date().toISOString();
      const stamp = generatedAt.replace(/[:.]/g, '-');
      const baseName = `specyfikacja-pim-${stamp}`;

      const jsonPayload = {
        metadata: {
          title: 'Specyfikacja PIM — Wirtualny Analityk',
          generatedAt,
          provider: chosenProvider,
          model: providerConfig.model ?? null,
          standards: ['MDA/PIM', 'BCE', 'ISO/IEC 19510 (BPMN 2.0)', 'ISO/IEC/IEEE 29148', 'SBVR'],
        },
        sections: markdownToSections(markdown),
        interview: session.history,
      };

      const docxBuffer = await markdownToDocx(markdown, {
        title: 'Specyfikacja PIM — Wirtualny Analityk',
        generatedAt,
      });

      await fs.mkdir(exportsDir, { recursive: true });
      await Promise.all([
        fs.writeFile(path.join(exportsDir, `${baseName}.md`), markdown, 'utf-8'),
        fs.writeFile(path.join(exportsDir, `${baseName}.json`), JSON.stringify(jsonPayload, null, 2), 'utf-8'),
        fs.writeFile(path.join(exportsDir, `${baseName}.docx`), docxBuffer),
      ]);

      logger.info('export: zapisano pakiet specyfikacji', { baseName });
      res.json({
        ok: true,
        files: {
          markdown: `/exports/${baseName}.md`,
          json: `/exports/${baseName}.json`,
          docx: `/exports/${baseName}.docx`,
        },
      });
    } catch (error) {
      logger.error('export: błąd generacji specyfikacji', { message: error.message });
      res.status(502).json({ error: 'Nie udało się wygenerować specyfikacji. Spróbuj ponownie.' });
    }
  };
}
