'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PluginWebContext } from '@kompetenzhub/plugin-contracts';
import { unzipSync } from 'fflate';

interface CoreClassRef {
  classId: string;
  name: string;
  moduleId: string | null;
  moduleNumber: string | null;
  classStatus: string;
}
interface EvidenceRef {
  evidenceId: string;
  title: Record<string, string>;
  maxPoints: number | null;
}
interface ProcessReport {
  matched: { folder: string; displayName: string; fileCount: number; status: string }[];
  unmatched: { folder: string; fileCount: number }[];
}

function title(rec: Record<string, string>, locale: string, fallback: string): string {
  return rec[locale] ?? rec.de ?? Object.values(rec)[0] ?? fallback;
}

/** Inhaltstyp anhand der Dateiendung (für den presignten Upload). */
function guessType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    txt: 'text/plain',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[ext] ?? 'application/octet-stream';
}

interface FolderFiles {
  folder: string;
  files: { key: string; name: string }[];
}

/**
 * Plugin-Seite: Lehrperson wählt Modul + „von Lehrperson angefügt"-Nachweis und lädt
 * ein ZIP hoch. Das ZIP wird im Browser entpackt (fflate); pro Top-Level-Ordner
 * (= Name der lernenden Person) werden die Dateien in den gescopten Plugin-Storage
 * hochgeladen und anschliessend serverseitig dem passenden Lernenden zugeordnet.
 */
export default function ZipImportPage({ ctx }: { ctx: PluginWebContext }) {
  const [classes, setClasses] = useState<CoreClassRef[]>([]);
  const [classId, setClassId] = useState('');
  const [evidences, setEvidences] = useState<EvidenceRef[]>([]);
  const [evidenceId, setEvidenceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<ProcessReport | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const moduleId = classes.find((c) => c.classId === classId)?.moduleId ?? '';

  useEffect(() => {
    ctx
      .apiFetch<CoreClassRef[]>('/classes')
      .then((list) => {
        setClasses(list);
        if (list[0]) setClassId(list[0].classId);
      })
      .catch(() => setClasses([]));
  }, [ctx]);

  const loadEvidences = useCallback(async () => {
    if (!moduleId) {
      setEvidences([]);
      setEvidenceId('');
      return;
    }
    try {
      const list = await ctx.apiFetch<EvidenceRef[]>('/evidences', { query: { moduleId } });
      setEvidences(list);
      setEvidenceId(list[0]?.evidenceId ?? '');
    } catch {
      setEvidences([]);
      setEvidenceId('');
    }
  }, [ctx, moduleId]);

  useEffect(() => {
    void loadEvidences();
  }, [loadEvidences]);

  async function handleZip(file: File) {
    setError('');
    setReport(null);
    if (!moduleId || !evidenceId) {
      setError(ctx.t('plugin.zip-import.pickFirst', 'Bitte zuerst Modul und Nachweis wählen.'));
      return;
    }
    setBusy(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let entries: Record<string, Uint8Array>;
      try {
        entries = unzipSync(buf);
      } catch {
        setError(ctx.t('plugin.zip-import.badZip', 'Die Datei ist kein gültiges ZIP.'));
        return;
      }

      // Nach Top-Level-Ordner gruppieren (Ordner = Name der lernenden Person).
      const byFolder = new Map<string, { name: string; bytes: Uint8Array }[]>();
      for (const [path, bytes] of Object.entries(entries)) {
        if (path.endsWith('/')) continue; // Verzeichniseintrag
        const parts = path.split('/').filter(Boolean);
        if (parts.length < 2) continue; // Datei muss in einem Ordner liegen
        if (parts[0] === '__MACOSX') continue; // macOS-Beiwerk
        const name = parts[parts.length - 1];
        if (name.startsWith('.')) continue; // versteckte/System-Dateien
        const arr = byFolder.get(parts[0]) ?? [];
        arr.push({ name, bytes });
        byFolder.set(parts[0], arr);
      }

      if (byFolder.size === 0) {
        setError(
          ctx.t(
            'plugin.zip-import.noFolders',
            'Im ZIP wurden keine Ordner mit Dateien gefunden (erwartet: ein Ordner pro Lernende:r).',
          ),
        );
        return;
      }

      const total = [...byFolder.values()].reduce((n, f) => n + f.length, 0);
      setProgress({ done: 0, total });

      // Dateien je Ordner in den Plugin-Storage hochladen.
      const folders: FolderFiles[] = [];
      let done = 0;
      for (const [folder, files] of byFolder) {
        const uploaded: { key: string; name: string }[] = [];
        for (const f of files) {
          const contentType = guessType(f.name);
          const { uploadUrl, key } = await ctx.apiFetch<{ uploadUrl: string; key: string }>(
            '/upload-url',
            { method: 'POST', body: { fileName: f.name, contentType } },
          );
          const put = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: new Blob([new Uint8Array(f.bytes)], { type: contentType }),
          });
          if (!put.ok) throw new Error(`Upload fehlgeschlagen: ${f.name}`);
          uploaded.push({ key, name: f.name });
          done += 1;
          setProgress({ done, total });
        }
        folders.push({ folder, files: uploaded });
      }

      const result = await ctx.apiFetch<ProcessReport>('/process', {
        method: 'POST',
        body: { classId, moduleId, evidenceId, folders },
      });
      setReport(result);
    } catch (e) {
      setError((e as Error).message || ctx.t('plugin.zip-import.failed', 'Import fehlgeschlagen.'));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>🗂 {ctx.t('plugin.zip-import.title', 'ZIP-Import')}</h2>
      </div>
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p className="kh-muted" style={{ margin: 0, fontSize: 13 }}>
          {ctx.t(
            'plugin.zip-import.intro',
            'Lade ein ZIP hoch: ein Ordner pro Lernende:r (Ordnername = Anzeigename), darin die Dateien. Die Dateien werden dem gewählten „von Lehrperson angefügt"-Nachweis der jeweiligen Person angehängt.',
          )}
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label className="fld" style={{ minWidth: 220 }}>
            <span className="field-label">{ctx.t('plugin.zip-import.module', 'Modulanlass')}</span>
            <select
              className="inline-select"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              {classes.length === 0 && (
                <option value="">
                  {ctx.t('plugin.zip-import.noClasses', '— kein Modulanlass —')}
                </option>
              )}
              {classes.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.name}
                  {c.moduleNumber
                    ? ` · ${ctx.t('plugin.zip-import.moduleShort', 'Modul')} ${c.moduleNumber}`
                    : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="fld" style={{ minWidth: 220 }}>
            <span className="field-label">{ctx.t('plugin.zip-import.evidence', 'Nachweis')}</span>
            <select
              className="inline-select"
              value={evidenceId}
              onChange={(e) => setEvidenceId(e.target.value)}
            >
              {evidences.length === 0 && (
                <option value="">
                  {ctx.t('plugin.zip-import.noEvidence', '— kein passender Nachweis —')}
                </option>
              )}
              {evidences.map((e) => (
                <option key={e.evidenceId} value={e.evidenceId}>
                  {title(e.title, ctx.locale, e.evidenceId)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {evidences.length === 0 && moduleId && (
          <p className="kh-muted" style={{ margin: 0, fontSize: 13 }}>
            {ctx.t(
              'plugin.zip-import.hintCreate',
              'Für dieses Modul gibt es keinen „von Lehrperson angefügt"-Nachweis. Lege zuerst einen solchen Nachweis im Kompetenzraster an.',
            )}
          </p>
        )}

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleZip(f);
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            padding: '26px 16px',
            border: `2px dashed ${dragOver ? 'var(--primary, #2563eb)' : 'var(--border)'}`,
            borderRadius: 10,
            background: dragOver ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
            cursor: busy || !evidenceId ? 'not-allowed' : 'pointer',
            opacity: busy || !evidenceId ? 0.6 : 1,
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 26 }} aria-hidden>
            🗂
          </span>
          <strong>
            {busy
              ? progress
                ? `${ctx.t('plugin.zip-import.uploading', 'Lade hoch')} ${progress.done}/${progress.total} …`
                : ctx.t('plugin.zip-import.processing', 'Verarbeite …')
              : ctx.t('plugin.zip-import.drop', 'ZIP hierher ziehen oder klicken')}
          </strong>
          <span className="kh-muted" style={{ fontSize: 12 }}>
            {ctx.t(
              'plugin.zip-import.dropHint',
              'Ein Ordner pro Lernende:r mit den Dateien darin.',
            )}
          </span>
          <input
            type="file"
            accept=".zip,application/zip"
            disabled={busy || !evidenceId}
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleZip(f);
              e.target.value = '';
            }}
          />
        </label>

        {error && (
          <div className="sub-status sub-rejected" style={{ margin: 0 }}>
            <strong>⚠ {error}</strong>
          </div>
        )}

        {report && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="sub-status sub-graded" style={{ margin: 0 }}>
              <strong>
                ✅ {report.matched.length} {ctx.t('plugin.zip-import.assigned', 'zugeordnet')} ·{' '}
                {report.unmatched.length} {ctx.t('plugin.zip-import.skipped', 'übersprungen')}
              </strong>
            </div>

            {report.matched.length > 0 && (
              <div>
                <div className="field-label">
                  {ctx.t('plugin.zip-import.assigned', 'zugeordnet')}
                </div>
                <ul
                  className="hz-list"
                  style={{ border: '1px solid var(--border)', borderRadius: 8 }}
                >
                  {report.matched.map((m) => (
                    <li key={m.folder} className="hz-item" style={{ alignItems: 'center' }}>
                      <span style={{ flex: 1 }}>
                        ✅ {m.displayName}
                        {m.displayName !== m.folder ? ` (${m.folder})` : ''}
                      </span>
                      <span className="kh-muted" style={{ fontSize: 12 }}>
                        {m.fileCount} {ctx.t('plugin.zip-import.files', 'Dateien')} · {m.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.unmatched.length > 0 && (
              <div>
                <div className="field-label">
                  {ctx.t('plugin.zip-import.notAssigned', 'nicht zugeordnet (kein passender Name)')}
                </div>
                <ul
                  className="hz-list"
                  style={{ border: '1px solid var(--border)', borderRadius: 8 }}
                >
                  {report.unmatched.map((u) => (
                    <li key={u.folder} className="hz-item" style={{ alignItems: 'center' }}>
                      <span style={{ flex: 1 }}>↩ {u.folder}</span>
                      <span className="kh-muted" style={{ fontSize: 12 }}>
                        {u.fileCount} {ctx.t('plugin.zip-import.files', 'Dateien')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
