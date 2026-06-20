'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Leichtgewichtiger Rich-Text-Editor (contentEditable, ohne externe Abhängigkeit).
 * Unterstützt Fett, Kursiv, Listen, Links, Bilder (per URL oder Datei-Upload) und
 * Video-Embeds (YouTube/Vimeo als responsive iframes). Liefert HTML.
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Beschreibung …',
  uploadImage,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Optional: lädt eine Bilddatei hoch und liefert die einbettbare URL. */
  uploadImage?: (file: File) => Promise<string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Initialinhalt setzen (nur wenn abweichend, um Cursor-Sprünge zu vermeiden)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  function emit() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  }

  function addLink() {
    const url = prompt('Link-URL (https://…)');
    if (!url) return;
    exec('createLink', url);
  }

  function addImage() {
    const url = prompt('Bild-URL (https://…)');
    if (!url) return;
    exec('insertImage', url);
  }

  async function onPickImage(file: File) {
    if (!uploadImage) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      ref.current?.focus();
      document.execCommand('insertImage', false, url);
      emit();
    } catch {
      alert('Bild-Upload fehlgeschlagen.');
    } finally {
      setUploading(false);
    }
  }

  function addVideo() {
    const url = prompt('Video-URL (YouTube, Vimeo oder direkter Link)');
    if (!url) return;
    const embed = toEmbed(url.trim());
    ref.current?.focus();
    document.execCommand('insertHTML', false, embed);
    emit();
  }

  return (
    <div className="rte">
      <div className="rte-toolbar">
        <button type="button" title="Fett" onClick={() => exec('bold')}>
          <strong>B</strong>
        </button>
        <button type="button" title="Kursiv" onClick={() => exec('italic')}>
          <em>I</em>
        </button>
        <button type="button" title="Liste" onClick={() => exec('insertUnorderedList')}>
          ☰
        </button>
        <span className="rte-sep" />
        <button type="button" title="Link einfügen" onClick={addLink}>
          🔗 Link
        </button>
        <button type="button" title="Bild per URL" onClick={addImage}>
          🖼 Bild-URL
        </button>
        {uploadImage && (
          <button
            type="button"
            title="Bild vom PC hochladen"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? '⏳ …' : '⬆ Bild'}
          </button>
        )}
        <button type="button" title="Video einbetten" onClick={addVideo}>
          🎬 Video
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPickImage(f);
            e.target.value = '';
          }}
        />
      </div>
      <div
        ref={ref}
        className="rte-area"
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        suppressContentEditableWarning
      />
    </div>
  );
}

/** Wandelt eine Video-URL in ein einbettbares iframe (YouTube/Vimeo) oder einen Link. */
function toEmbed(url: string): string {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (yt) {
    return `<div class="rte-video"><iframe src="https://www.youtube.com/embed/${yt[1]}" frameborder="0" allowfullscreen></iframe></div>`;
  }
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) {
    return `<div class="rte-video"><iframe src="https://player.vimeo.com/video/${vimeo[1]}" frameborder="0" allowfullscreen></iframe></div>`;
  }
  // Fallback: anklickbarer Link
  return `<p><a href="${url}" target="_blank" rel="noopener">🎬 Video: ${url}</a></p>`;
}
