'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';

/**
 * Datum-/Uhrzeit-Auswahl für Abgabetermine mit Kalenderwoche (ISO-8601).
 *
 * Der Wert ist – wie bei <input type="datetime-local"> – lokale Wandzeit im
 * Format `YYYY-MM-DDTHH:mm` (oder '' für "kein Termin"). Die Umrechnung nach
 * UTC passiert erst beim Speichern, damit keine Zeitzonen-Verschiebung entsteht.
 */

/** Standardzeit, wenn nur ein Datum gewählt wird: Ende des Tages. */
export const DEFAULT_DUE_TIME = '23:59';

const INTL_LOCALE: Record<string, string> = {
  de: 'de-CH',
  fr: 'fr-CH',
  it: 'it-CH',
  en: 'en-GB',
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Lokaler Tagesschlüssel `YYYY-MM-DD` – bewusst ohne toISOString(), das nach UTC schiebt. */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Kalenderwoche nach ISO-8601: die Woche, in der der Donnerstag liegt. */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** Montag der Woche, in der `d` liegt. */
function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function DueDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t, locale } = useI18n();
  const intlLocale = INTL_LOCALE[locale] ?? 'de-CH';
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [datePart, timePart] = value ? value.split('T') : ['', ''];
  const selectedDay = datePart ? parseDayKey(datePart) : null;
  const selectedKey = selectedDay ? localDayKey(selectedDay) : '';
  const todayKey = localDayKey(new Date());

  const [view, setView] = useState<Date>(() => startOfMonth(selectedDay ?? new Date()));

  const close = useCallback(() => setOpen(false), []);

  function toggle() {
    if (!open) setView(startOfMonth(selectedDay ?? new Date()));
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Escape schliesst zuerst nur den Kalender – nicht das umgebende Modal.
      e.stopPropagation();
      e.stopImmediatePropagation();
      close();
    };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, close]);

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale, { weekday: 'short' });
    const monday = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => fmt.format(addDays(monday, i)));
  }, [intlLocale]);

  const weeks = useMemo(() => {
    const first = startOfWeek(view);
    return Array.from({ length: 6 }, (_, w) => {
      const days = Array.from({ length: 7 }, (_, i) => addDays(first, w * 7 + i));
      // Der Donnerstag bestimmt die ISO-Kalenderwoche der Zeile.
      return { kw: isoWeek(days[3]), days };
    });
  }, [view]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { month: 'long', year: 'numeric' }).format(view),
    [intlLocale, view],
  );

  const triggerLabel = useMemo(() => {
    if (!selectedDay) return t('dp.none');
    const d = new Intl.DateTimeFormat(intlLocale, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(selectedDay);
    return `${d}, ${timePart || DEFAULT_DUE_TIME} · ${t('dp.weekShort')} ${isoWeek(selectedDay)}`;
  }, [selectedDay, timePart, intlLocale, t]);

  /** Tag wählen: ohne bereits gesetzte Uhrzeit gilt das Tagesende (23:59). */
  function pickDay(d: Date) {
    onChange(`${localDayKey(d)}T${timePart || DEFAULT_DUE_TIME}`);
    close();
  }

  function setTime(v: string) {
    const day = datePart || todayKey;
    onChange(`${day}T${v || DEFAULT_DUE_TIME}`);
  }

  function clear() {
    onChange('');
    close();
  }

  return (
    <div className="dtp" ref={wrapRef}>
      <button
        type="button"
        className={`dtp-trigger${selectedDay ? '' : ' is-empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <span aria-hidden="true">📅</span>
        <span className="dtp-value">{triggerLabel}</span>
      </button>
      {selectedDay && (
        <button type="button" className="dtp-clear" title={t('dp.clear')} onClick={clear}>
          ✕
        </button>
      )}

      {open && (
        <div className="dtp-pop" role="dialog" aria-label={t('fe.dueUntil')}>
          <div className="dtp-nav">
            <button
              type="button"
              className="dtp-nav-btn"
              title={t('dp.prevMonth')}
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <strong className="dtp-month">{monthLabel}</strong>
            <button
              type="button"
              className="dtp-nav-btn"
              title={t('dp.nextMonth')}
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>

          <div className="dtp-grid" role="grid">
            <div className="dtp-kw dtp-th" title={t('dp.week')}>
              {t('dp.weekShort')}
            </div>
            {weekdays.map((w) => (
              <div key={w} className="dtp-th">
                {w}
              </div>
            ))}
            {weeks.map(({ kw, days }) => (
              <div key={`${kw}-${localDayKey(days[0])}`} className="dtp-week" role="row">
                <div className="dtp-kw" title={`${t('dp.week')} ${kw}`}>
                  {kw}
                </div>
                {days.map((d) => {
                  const key = localDayKey(d);
                  const outside = d.getMonth() !== view.getMonth();
                  return (
                    <button
                      type="button"
                      key={key}
                      role="gridcell"
                      aria-selected={key === selectedKey}
                      className={[
                        'dtp-day',
                        outside ? 'is-outside' : '',
                        key === todayKey ? 'is-today' : '',
                        key === selectedKey ? 'is-selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => pickDay(d)}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="dtp-foot">
            <label className="dtp-time">
              {t('dp.time')}
              <input
                type="time"
                value={timePart || DEFAULT_DUE_TIME}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
            <button type="button" className="btn sm" onClick={() => pickDay(new Date())}>
              {t('dp.today')}
            </button>
            <button type="button" className="btn sm" onClick={clear}>
              {t('dp.clear')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
