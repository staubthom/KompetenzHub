// Fehler-Signalisierung für Plugin-Handler. Plugins kennen NestJS nicht, brauchen
// aber eine Möglichkeit, korrekte HTTP-Status (403/404/400/409) zu liefern. Der Kern-
// Dispatcher erkennt PluginHttpError (per Duck-Typing) und mappt ihn auf die passende
// HTTP-Antwort. Andere geworfene Fehler werden zu 500.

export class PluginHttpError extends Error {
  readonly isPluginHttpError = true;
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PluginHttpError';
  }
}

/** 400 – ungültige Eingabe. */
export const badRequest = (message = 'Ungültige Anfrage'): PluginHttpError =>
  new PluginHttpError(400, message);
/** 403 – kein Zugriff (z. B. fehlende Berechtigung auf den Modulanlass). */
export const forbidden = (message = 'Kein Zugriff'): PluginHttpError =>
  new PluginHttpError(403, message);
/** 404 – Ressource existiert nicht (oder soll nicht enumerierbar sein). */
export const notFound = (message = 'Nicht gefunden'): PluginHttpError =>
  new PluginHttpError(404, message);
/** 409 – Konflikt (z. B. Aktion im aktuellen Zustand nicht erlaubt). */
export const conflict = (message = 'Konflikt'): PluginHttpError =>
  new PluginHttpError(409, message);

/** Duck-Typing-Prüfung (robuster als instanceof über Modulgrenzen hinweg). */
export function isPluginHttpError(e: unknown): e is PluginHttpError {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { isPluginHttpError?: boolean }).isPluginHttpError === true &&
    typeof (e as { status?: unknown }).status === 'number'
  );
}
