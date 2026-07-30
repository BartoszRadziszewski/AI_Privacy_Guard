// Generator DOCX specyfikacji PIM — renderuje Markdown (nagłówki, listy, tabele,
// bloki kodu/Mermaid, akapity) do dokumentu Word przy pomocy biblioteki docx.
import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const PAGE_WIDTH_DXA = 9026; // A4 szer. treści przy domyślnych marginesach

function headingLevel(depth) {
  return [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ][Math.min(depth, 6) - 1];
}

// Inline: **bold**, *italic*, `code` → TextRun-y.
function inlineRuns(text, extra = {}) {
  const runs = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) runs.push(new TextRun({ text: text.slice(last, match.index), ...extra }));
    const token = match[0];
    if (token.startsWith('**')) {
      runs.push(new TextRun({ text: token.slice(2, -2), bold: true, ...extra }));
    } else if (token.startsWith('`')) {
      runs.push(new TextRun({ text: token.slice(1, -1), font: 'Courier New', ...extra }));
    } else {
      runs.push(new TextRun({ text: token.slice(1, -1), italics: true, ...extra }));
    }
    last = match.index + token.length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), ...extra }));
  return runs.length ? runs : [new TextRun({ text: '', ...extra })];
}

function tableFromRows(rows) {
  const columnCount = Math.max(...rows.map((r) => r.length));
  const columnWidth = Math.floor(PAGE_WIDTH_DXA / columnCount);
  return new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: Array(columnCount).fill(columnWidth),
    rows: rows.map(
      (cells, rowIndex) =>
        new TableRow({
          children: Array.from({ length: columnCount }, (_, i) => {
            const text = cells[i] ?? '';
            return new TableCell({
              width: { size: columnWidth, type: WidthType.DXA },
              shading:
                rowIndex === 0
                  ? { type: ShadingType.CLEAR, fill: 'E8EAF0' }
                  : undefined,
              children: [
                new Paragraph({ children: inlineRuns(text, rowIndex === 0 ? { bold: true } : {}) }),
              ],
            });
          }),
        })
    ),
  });
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function isSeparatorRow(line) {
  return /^\s*\|?\s*:?-{2,}.*\|/.test(line);
}

/**
 * @param {string} markdown treść specyfikacji
 * @param {{title?: string}} meta
 * @returns {Promise<Buffer>} bufor pliku .docx
 */
export async function markdownToDocx(markdown, meta = {}) {
  const lines = markdown.split(/\r?\n/);
  const children = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: meta.title ?? 'Specyfikacja PIM — Wirtualny Analityk' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Wygenerowano: ${meta.generatedAt ?? new Date().toISOString()}`,
          italics: true,
          size: 18,
        }),
      ],
    }),
    new Paragraph({ children: [] })
  );

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blok kodu / diagram Mermaid
    if (line.trimStart().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // zamykający ```
      if (language) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `[${language}]`, italics: true, size: 16 })],
          })
        );
      }
      for (const codeLine of code) {
        children.push(
          new Paragraph({
            shading: { type: ShadingType.CLEAR, fill: 'F4F4F4' },
            children: [new TextRun({ text: codeLine || ' ', font: 'Courier New', size: 18 })],
          })
        );
      }
      continue;
    }

    // Tabela
    if (line.trim().startsWith('|') && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const rows = [splitTableRow(line)];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      children.push(tableFromRows(rows), new Paragraph({ children: [] }));
      continue;
    }

    // Nagłówek
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      children.push(
        new Paragraph({
          heading: headingLevel(headingMatch[1].length),
          children: inlineRuns(headingMatch[2]),
        })
      );
      i += 1;
      continue;
    }

    // Lista punktowana / numerowana
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    const orderedMatch = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (bulletMatch || orderedMatch) {
      const match = bulletMatch ?? orderedMatch;
      const level = Math.min(Math.floor(match[1].length / 2), 2);
      children.push(
        new Paragraph({
          children: inlineRuns(match[2]),
          numbering: {
            reference: bulletMatch ? 'bullets' : 'ordered',
            level,
          },
        })
      );
      i += 1;
      continue;
    }

    // Pusta linia
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Zwykły akapit
    children.push(new Paragraph({ children: inlineRuns(line) }));
    i += 1;
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.BULLET,
            text: '•',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
        {
          reference: 'ordered',
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
