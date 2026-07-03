import sanitizeHtml from 'sanitize-html';

/**
 * Zentrale HTML-Sanitisierung für benutzererstellte Rich-Text-Felder (z. B. die
 * Aufgaben-Instruktionen eines Nachweises). Diese Felder werden im Frontend über
 * `dangerouslySetInnerHTML` gerendert – ohne Filterung könnte eine Lehrperson
 * damit Stored-XSS-Payloads (`<img onerror=…>`, `<script>` …) einschleusen, die
 * im Browser von Lernenden UND Admins (Bewertungsansicht) ausgeführt würden.
 *
 * Erlaubt bewusst nur ein sicheres Formatierungs-Subset. iframes sind für die
 * Video-Embed-Funktion nötig, werden aber per Host-Allowlist auf YouTube/Vimeo
 * begrenzt (ein beliebiges iframe wäre selbst ein XSS-/Clickjacking-Vektor).
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'b',
    'strong',
    'i',
    'em',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'h1',
    'h2',
    'h3',
    'h4',
    'blockquote',
    'code',
    'pre',
    'span',
    'div',
    'iframe',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow'],
    div: ['class'],
    span: ['class'],
  },
  // Keine javascript:/vbscript:/data:-URLs; data: auch nicht für Bilder (SVG-XSS).
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  // iframes nur von diesen Hosts (Video-Embeds); alles andere wird verworfen.
  allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'player.vimeo.com'],
  allowIframeRelativeUrls: false,
  // Links immer entkoppeln (verhindert reverse tabnabbing).
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
  disallowedTagsMode: 'discard',
};

/** Bereinigt einen einzelnen HTML-String auf das sichere Rich-Text-Subset. */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}
