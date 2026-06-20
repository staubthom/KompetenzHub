'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { evidence, type StudentEvidence } from '../../../lib/api';

export default function QuizPage() {
  const [list, setList] = useState<StudentEvidence[] | null>(null);
  const [active, setActive] = useState<StudentEvidence | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<{ points: number; maxPoints: number } | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      setList(await evidence.studentList('QUIZ'));
    } catch (e: unknown) {
      setError(String(e));
    }
  }
  useEffect(() => { void load(); }, []);

  function startQuiz(ev: StudentEvidence) {
    setActive(ev);
    setAnswers({});
    setResult(null);
    setError('');
  }

  function selectOption(q: { id: string; type: string }, optId: string) {
    setAnswers((a) => {
      const cur = a[q.id] ?? [];
      if (q.type === 'single') return { ...a, [q.id]: [optId] };
      return { ...a, [q.id]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
    });
  }

  async function submit() {
    if (!active) return;
    try {
      setResult(await evidence.gradeQuiz(active.id, answers));
    } catch (e: unknown) {
      const err = e as { body?: { title?: string } };
      setError(err.body?.title ?? 'Auswertung fehlgeschlagen.');
    }
  }

  // Quiz lösen
  if (active) {
    const questions = active.config.questions ?? [];
    return (
      <AppShell>
        <div className="breadcrumb">Meine Matrix / Quiz</div>
        <div className="page-head">
          <div>
            <h1>{active.title?.de}</h1>
            <p>{questions.length} Fragen · automatische Auswertung{active.maxPoints ? ` · max. ${active.maxPoints} Punkte` : ''}</p>
          </div>
          <button className="btn" onClick={() => { setActive(null); void load(); }}>← Zurück</button>
        </div>

        {error && <div className="error">{error}</div>}

        {result ? (
          <div className="panel">
            <div className="quiz-result">
              <div className="score">{result.points} / {result.maxPoints}</div>
              <p className="kh-muted">Punkte erreicht. Das Ergebnis wurde gespeichert.</p>
              <button className="btn primary" onClick={() => { setActive(null); void load(); }}>Fertig</button>
            </div>
          </div>
        ) : (
          <div className="panel">
            <div className="panel-body">
              {questions.map((q, i) => (
                <div key={q.id} className="question">
                  <div className="q">{i + 1}. {q.text} {q.type === 'multiple' && <span className="kh-muted">(Mehrfachauswahl)</span>}</div>
                  {q.options.map((o) => (
                    <label key={o.id} className="opt">
                      <input
                        type={q.type === 'single' ? 'radio' : 'checkbox'}
                        name={q.id}
                        checked={(answers[q.id] ?? []).includes(o.id)}
                        onChange={() => selectOption(q, o.id)}
                      />
                      {o.text}
                    </label>
                  ))}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn primary" onClick={() => { void submit(); }}>Abschliessen &amp; auswerten</button>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    );
  }

  // Quiz-Liste
  return (
    <AppShell>
      <div className="breadcrumb">Meine Matrix / Quiz</div>
      <div className="page-head">
        <div><h1>Quiz</h1><p>Verfügbare Quiz-Nachweise deiner Klassen</p></div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="panel">
        {!list ? (
          <div className="loading">Lade Quiz…</div>
        ) : list.length === 0 ? (
          <div className="empty"><span className="ic">❓</span><p>Aktuell sind keine Quiz verfügbar.</p></div>
        ) : (
          <div className="evidence-list">
            {list.map((ev) => (
              <div key={ev.id} className="evidence-item">
                <div>
                  <strong>{ev.title?.de}</strong>
                  <div className="evidence-meta">
                    {(ev.config.questions?.length ?? 0)} Fragen
                    {ev.maxPoints ? ` · max. ${ev.maxPoints} Punkte` : ''}
                    {ev.dueAt && <> · {ev.isOverdue ? <span className="overdue">überfällig</span> : `fällig ${new Date(ev.dueAt).toLocaleDateString('de-CH')}`}</>}
                  </div>
                </div>
                <button className="btn primary sm" onClick={() => startQuiz(ev)}>Starten</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
