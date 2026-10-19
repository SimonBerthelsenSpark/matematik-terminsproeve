import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useClasses } from '../hooks/useClasses.js';
import { Loader2, Trash2, Plus, X, Users } from './Icons.jsx';
import { PageHeader, Spinner, Notice, EmptyState, useConfirm } from './ui.jsx';

/**
 * Klasser og elever: liste til venstre, valgt klasse til højre.
 */
export function ClassManagement() {
  const confirm = useConfirm();
  const { classes, loading, error, createClass, deleteClass, addStudent, getStudents, deleteStudent } = useClasses();

  const [selectedId, setSelectedId] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [creating, setCreating] = useState(false);

  const selected = classes.find(c => c.id === selectedId) || null;

  // Vælg første klasse automatisk
  useEffect(() => {
    if (!selectedId && classes.length > 0) setSelectedId(classes[0].id);
    if (selectedId && classes.length > 0 && !classes.some(c => c.id === selectedId)) setSelectedId(classes[0].id);
  }, [classes, selectedId]);

  const loadStudents = useCallback(async (classId) => {
    if (!classId) return;
    try {
      setLoadingStudents(true);
      setStudents(await getStudents(classId));
    } catch (err) {
      toast.error(`Eleverne kunne ikke indlæses: ${err.message}`);
    } finally {
      setLoadingStudents(false);
    }
  }, [getStudents]);

  useEffect(() => { loadStudents(selectedId); }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateClass = async (e) => {
    e.preventDefault();
    const name = newClassName.trim();
    if (!name) return;
    try {
      setCreating(true);
      const id = await createClass(name);
      setNewClassName('');
      setShowCreate(false);
      if (id) setSelectedId(id);
      toast.success(`Klassen ${name} er oprettet`);
    } catch (err) {
      toast.error(`Klassen kunne ikke oprettes: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: `Slet klassen ${selected.className}?`,
      message: `Klassen og dens ${selected.studentCount || 0} elever slettes. Prøver for klassen bliver ikke slettet.`,
      confirmLabel: 'Slet klasse',
      danger: true
    });
    if (!ok) return;
    try {
      await deleteClass(selected.id);
      setSelectedId(null);
      toast.success('Klassen er slettet');
    } catch (err) {
      toast.error(`Klassen kunne ikke slettes: ${err.message}`);
    }
  };

  return (
    <>
      <PageHeader
        title="Klasser"
        description="Eleverne bruges til at navngive og samle besvarelserne for hver prøve."
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowCreate(v => !v)} aria-expanded={showCreate}>
            <Plus className="w-4 h-4" /> Ny klasse
          </button>
        }
      />

      {showCreate && (
        <form onSubmit={handleCreateClass} className="surface p-4 mb-6 flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <label htmlFor="new-class" className="field-label">Klassens navn</label>
            <input id="new-class" className="input" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="Fx 9.A" autoFocus />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={creating || !newClassName.trim()}>
              {creating && <Loader2 />} Opret klasse
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Annuller</button>
          </div>
        </form>
      )}

      {loading && classes.length === 0 && <Spinner label="Indlæser klasser…" />}
      {error && !loading && <Notice title="Klasserne kunne ikke indlæses">{error}</Notice>}

      {!loading && !error && classes.length === 0 && (
        <div className="surface">
          <EmptyState title="Ingen klasser endnu" action={<button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Opret første klasse</button>}>
            Opret klassen og tilføj eleverne. Du kan indsætte hele elevlisten på én gang.
          </EmptyState>
        </div>
      )}

      {!error && classes.length > 0 && (
        <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)] items-start">
          {/* Klasseliste */}
          <nav aria-label="Klasser" className="surface p-1.5">
            <ul className="flex md:flex-col gap-1 overflow-x-auto">
              {classes.map(cls => {
                const active = cls.id === selectedId;
                return (
                  <li key={cls.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedId(cls.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full flex items-center justify-between gap-4 rounded-control px-3 py-2 text-left text-sm transition-colors ${
                        active ? 'bg-ink text-white' : 'hover:bg-paper'
                      }`}
                    >
                      <span className="font-semibold">{cls.className}</span>
                      <span className={`num text-[13px] ${active ? 'text-white/70' : 'text-ink-soft'}`}>{cls.studentCount || 0}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Valgt klasse */}
          {selected && (
            <ClassDetail
              key={selected.id}
              cls={selected}
              students={students}
              loading={loadingStudents}
              onDeleteClass={handleDeleteClass}
              addStudent={addStudent}
              deleteStudent={deleteStudent}
              reload={() => loadStudents(selected.id)}
            />
          )}
        </div>
      )}
    </>
  );
}

/**
 * Fortolk en indsat elevliste. Hver linje: "nummer navn" eller bare "navn".
 * Uden nummer fortsættes nummereringen fra det højeste eksisterende nummer.
 */
export function parseElevliste(text, startNummer = 1) {
  let next = startNummer;
  return String(text)
    .split(/\r?\n/)
    .map(l => l.replace(/\t/g, ' ').trim())
    .filter(Boolean)
    .map(line => {
      const m = line.match(/^(\d+)[.\s,;:)-]+(.+)$/);
      if (m) {
        next = Math.max(next, Number(m[1]) + 1);
        return { studentNumber: m[1], studentName: m[2].trim() };
      }
      return { studentNumber: String(next++), studentName: line };
    });
}

function ClassDetail({ cls, students, loading, onDeleteClass, addStudent, deleteStudent, reload }) {
  const confirm = useConfirm();
  const [mode, setMode] = useState(null); // null | 'one' | 'many'
  const [nummer, setNummer] = useState('');
  const [navn, setNavn] = useState('');
  const [liste, setListe] = useState('');
  const [saving, setSaving] = useState(false);

  const nextNummer = students.reduce((m, s) => Math.max(m, Number(s.studentNumber) || 0), 0) + 1;
  const preview = mode === 'many' ? parseElevliste(liste, nextNummer) : [];

  const addOne = async (e) => {
    e.preventDefault();
    if (!navn.trim()) return;
    try {
      setSaving(true);
      await addStudent(cls.id, { studentNumber: (nummer.trim() || String(nextNummer)), studentName: navn.trim() });
      setNummer('');
      setNavn('');
      await reload();
    } catch (err) {
      toast.error(`Eleven kunne ikke tilføjes: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addMany = async (e) => {
    e.preventDefault();
    if (preview.length === 0) return;
    try {
      setSaving(true);
      for (const elev of preview) {
        await addStudent(cls.id, elev);
      }
      toast.success(`${preview.length} elever er tilføjet`);
      setListe('');
      setMode(null);
      await reload();
    } catch (err) {
      toast.error(`Ikke alle elever kunne tilføjes: ${err.message}`);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (student) => {
    const ok = await confirm({
      title: `Fjern ${student.studentName}?`,
      message: 'Eleven fjernes fra klassen. Besvarelser og karakterer på prøver bliver ikke slettet.',
      confirmLabel: 'Fjern elev',
      danger: true
    });
    if (!ok) return;
    try {
      await deleteStudent(cls.id, student.id);
      await reload();
    } catch (err) {
      toast.error(`Eleven kunne ikke fjernes: ${err.message}`);
    }
  };

  return (
    <section className="surface" aria-labelledby="class-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 pt-5">
        <div>
          <h2 id="class-title" className="text-[20px] font-semibold">{cls.className}</h2>
          <p className="text-sm text-ink-soft">{students.length} {students.length === 1 ? 'elev' : 'elever'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => setMode(mode === 'one' ? null : 'one')} aria-expanded={mode === 'one'}>
            <Plus className="w-4 h-4" /> Tilføj elev
          </button>
          <button type="button" className="btn-secondary" onClick={() => setMode(mode === 'many' ? null : 'many')} aria-expanded={mode === 'many'}>
            <Users className="w-4 h-4" /> Indsæt elevliste
          </button>
          <button type="button" className="btn-icon" onClick={onDeleteClass} aria-label={`Slet klassen ${cls.className}`} title="Slet klasse">
            <Trash2 />
          </button>
        </div>
      </div>

      {mode === 'one' && (
        <form onSubmit={addOne} className="mx-5 mt-4 p-4 rounded-control bg-paper flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="sm:w-28">
            <label htmlFor="elev-nr" className="field-label">Nummer</label>
            <input id="elev-nr" className="input num" inputMode="numeric" value={nummer} onChange={(e) => setNummer(e.target.value)} placeholder={String(nextNummer)} />
          </div>
          <div className="flex-1">
            <label htmlFor="elev-navn" className="field-label">Navn</label>
            <input id="elev-navn" className="input" value={navn} onChange={(e) => setNavn(e.target.value)} placeholder="Fornavn Efternavn" autoFocus />
          </div>
          <button type="submit" className="btn-primary" disabled={saving || !navn.trim()}>
            {saving && <Loader2 />} Tilføj
          </button>
        </form>
      )}

      {mode === 'many' && (
        <form onSubmit={addMany} className="mx-5 mt-4 p-4 rounded-control bg-paper">
          <label htmlFor="elevliste" className="field-label">Elevliste</label>
          <textarea
            id="elevliste"
            className="input h-36 py-2 resize-y"
            value={liste}
            onChange={(e) => setListe(e.target.value)}
            placeholder={'Én elev pr. linje, fx\n1 Anna Jensen\n2 Bo Nielsen'}
            autoFocus
          />
          <p className="field-hint">Kopiér gerne direkte fra et regneark. Linjer uden nummer nummereres fra {nextNummer}.</p>
          <div className="mt-3 flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving || preview.length === 0}>
              {saving && <Loader2 />} Tilføj {preview.length || ''} {preview.length === 1 ? 'elev' : 'elever'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setMode(null)}>Annuller</button>
          </div>
        </form>
      )}

      <div className="p-5">
        {loading ? (
          <Spinner label="Indlæser elever…" />
        ) : students.length === 0 ? (
          <p className="text-ink-soft py-6 text-center">Ingen elever endnu. Tilføj dem én ad gangen eller indsæt hele listen.</p>
        ) : (
          <ul className="divide-y divide-line border border-line rounded-control">
            {students.map(s => (
              <li key={s.id} className="group flex items-center gap-3 px-3 py-2">
                <span className="num w-8 text-right text-sm text-ink-soft">{s.studentNumber}</span>
                <span className="flex-1 text-sm">{s.studentName}</span>
                <button
                  type="button"
                  className="btn-icon md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                  onClick={() => remove(s)}
                  aria-label={`Fjern ${s.studentName}`}
                  title="Fjern elev"
                >
                  <X />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
