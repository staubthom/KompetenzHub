import { BadRequestException } from '@nestjs/common';

/**
 * Textextraktion für hochgeladene Bewertungskriterien-Dokumente (FA-70/72).
 *
 * Der extrahierte Text wandert in den KI-Prompt – nicht die Datei selbst. Darum
 * werden nur Formate akzeptiert, aus denen sich verlässlich Text gewinnen lässt.
 */

/** Obergrenze für den extrahierten Text (Schutz vor Prompt-Aufblähung und Kosten). */
export const RUBRIC_MAX_CHARS = 20_000;

/** Grösstes akzeptiertes Dokument – grössere Dateien sind fast nie Kriterienraster. */
export const RUBRIC_MAX_BYTES = 10 * 1024 * 1024;

export const RUBRIC_EXTENSIONS = ['pdf', 'docx', 'txt', 'md'] as const;

function extensionOf(fileName: string): string {
  return (fileName.split('.').pop() ?? '').toLowerCase();
}

/** Whitespace normalisieren, damit der Prompt kompakt bleibt. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();
}

export function isSupportedRubricFile(fileName: string): boolean {
  return (RUBRIC_EXTENSIONS as readonly string[]).includes(extensionOf(fileName));
}

/**
 * Liest den Text aus einem Kriteriendokument. Wirft 400, wenn das Format nicht
 * unterstützt wird oder sich kein Text gewinnen lässt (z. B. gescanntes PDF).
 */
export async function extractRubricText(bytes: Buffer, fileName: string): Promise<string> {
  if (bytes.length > RUBRIC_MAX_BYTES) {
    throw new BadRequestException('Das Dokument ist zu gross (max. 10 MB).');
  }
  const ext = extensionOf(fileName);
  let raw: string;

  switch (ext) {
    case 'pdf': {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(bytes) });
      try {
        // Seitenweise zusammensetzen: `.text` enthielte zusätzlich Seitenmarken
        // („-- 1 of 3 --"), die im Prompt nur stören.
        raw = (await parser.getText()).pages.map((p) => p.text).join('\n\n');
      } finally {
        await parser.destroy();
      }
      break;
    }
    case 'docx': {
      const mammoth = await import('mammoth');
      raw = (await mammoth.extractRawText({ buffer: bytes })).value;
      break;
    }
    case 'txt':
    case 'md':
      raw = bytes.toString('utf8');
      break;
    default:
      throw new BadRequestException(
        `Nicht unterstütztes Format „.${ext}". Erlaubt: ${RUBRIC_EXTENSIONS.join(', ')}.`,
      );
  }

  const text = tidy(raw);
  if (!text) {
    throw new BadRequestException(
      'Aus dem Dokument liess sich kein Text lesen. Gescannte PDFs ohne Texterkennung ' +
        'werden nicht unterstützt.',
    );
  }
  return text.slice(0, RUBRIC_MAX_CHARS);
}
