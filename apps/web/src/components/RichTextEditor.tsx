'use client';

import { useEffect, useRef } from 'react';

/**
 * Leichtgewichtiger Rich-Text-Editor (contentEditable, ohne externe Abhängigkeit).
 * Unterstützt Fett, Kursiv, Listen, Links, Bilder (per URL) und Video-Embeds
 * (YouTube/Vimeo werden als responsive iframes eingebettet). Liefert HTML.
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Beschreibung …',
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

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
          🖼 Bild
        </button>
        <button type="button" title="Video einbetten" onClick={addVideo}>
          🎬 Video
        </button>
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
