import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { updateExam } from '../services/firestoreService.js';
import { getFileDownloadURL } from '../services/storageService.js';
import { extractPdfText, extractWordText } from '../utils/docLibs.js';
import { SEVENTRIN, formatKarakter, parseOmsaetningstabel, validateTabel, normalizeTabel } from '../utils/karakter.js';

const tomTabel = () => SEVENTRIN.map(karakter => ({ karakter, minPoint: '', maxPoint: '' }));

/** Lav 7 rækker (én pr. karakter) ud fra en gemt eller fortolket tabel. */
function tilRaekker(rows) {
  const byKarakter = new Map(normalizeTabel(rows).map(r => [r.karakter, r]));
  return SEVENTRIN.map(karakter => {
    const r = byKarakter.get(karakter);
    return { karakter, minPoint: r ? r.minPoint : '', maxPoint: r?.maxPoint ?? '' };
  });
}

async function laesTekst(ref) {
  const url = await getFileDownloadURL(ref.storagePath);
  const blob = await (await fetch(url)).blob();
  const name = (ref.fileName || '').toLowerCase();
  if (name.endsWith('.pdf') || ref.contentType === 'application/pdf') return extractPdfText(blob);
  if (name.endsWith('.docx')) return extractWordText(blob);
  return blob.text();
}

/**
 * Omsætningstabel som struktureret data på prøven (exam.omsaetningstabelData).
 * Læreren kan læse den fra den uploadede fil, rette den og gemme.
 * Retningen bruger altid denne tabel, når den findes.
 */
export function OmsaetningstabelEditor({ exam, examId, onSaved }) {
  const [rows, setRows] = useState(() =>
    exam?.omsaetningstabelData?.length ? tilRaekker(exam.omsaetningstabelData) : tomTabel()
  );
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const saved = Boolean(exam?.omsaetningstabelData?.length);

  useEffect(() => {
    if (exam?.omsaetningstabelData?.length) setRows(tilRaekker(exam.omsaetningstabelData));
  }, [exam?.omsaetningstabelData]);

  const udfyldte = rows
    .filter(r => r.minPoint !== '' && r.minPoint !== null)
    .map(r => ({ karakter: r.karakter, minPoint: Number(r.minPoint), maxPoint: r.maxPoint === '' ? null : Number(r.maxPoint) }));
  const { valid, problems } = validateTabel(udfyldte);

  const handleChange = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const handleReadFromFile = async () => {
    if (!exam?.omsætningstabelRef?.storagePath) {
      toast.error('Upload omsætningstabellen som fil først');
      return;
    }
    try {
      setReading(true);
      const text = await laesTekst(exam.omsætningstabelRef);
      const parsed = parseOmsaetningstabel(text);
      if (!parsed) {
        toast.error('Tabellen kunne ikke læses automatisk. Udfyld den manuelt.');
        return;
      }
      setRows(tilRaekker(parsed));
      toast.success('Tabellen er læst fra filen. Tjek tallene, og tryk Gem.');
    } catch (err) {
      toast.error(`Kunne ikke læse filen: ${err.message}`);
    } finally {
      setReading(false);
    }
  };

  const handleSave = async () => {
    if (!valid) return;
    try {
      setSaving(true);
      await updateExam(examId, { omsaetningstabelData: normalizeTabel(udfyldte) });
      toast.success('Omsætningstabel gemt');
      onSaved?.();
    } catch (err) {
      toast.error(`Fejl ved gemning: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {!saved && exam?.omsætningstabelRef && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-control bg-paper px-4 py-3">
          <p className="flex-1 text-sm">Tabellen er ikke udfyldt. Læs tallene fra den uploadede fil, og tjek dem.</p>
          <button type="button" onClick={handleReadFromFile} disabled={reading} className="btn-primary btn-sm">
            {reading ? 'Læser…' : 'Læs fra filen'}
          </button>
        </div>
      )}

      <div className="border border-line rounded-control overflow-hidden max-w-md">
        <table className="table">
          <thead>
            <tr>
              <th>Karakter</th>
              <th>Fra point</th>
              <th>Til point</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.karakter}>
                <td className="num font-semibold !py-2">{formatKarakter(row.karakter)}</td>
                <td className="!py-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    inputMode="decimal"
                    value={row.minPoint}
                    onChange={(e) => handleChange(idx, 'minPoint', e.target.value)}
                    className="input num h-8 w-24"
                    aria-label={`Fra point for karakter ${formatKarakter(row.karakter)}`}
                  />
                </td>
                <td className="!py-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    inputMode="decimal"
                    value={row.maxPoint}
                    onChange={(e) => handleChange(idx, 'maxPoint', e.target.value)}
                    className="input num h-8 w-24"
                    aria-label={`Til point for karakter ${formatKarakter(row.karakter)}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!valid && udfyldte.length > 0 && (
        <ul className="mt-3 text-sm text-pen list-disc pl-5 space-y-0.5" role="alert">
          {problems.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button type="button" onClick={handleSave} disabled={!valid || saving} className="btn-primary">
          {saving ? 'Gemmer…' : 'Gem tabel'}
        </button>
        {saved && exam?.omsætningstabelRef && (
          <button type="button" onClick={handleReadFromFile} disabled={reading} className="btn-ghost">
            {reading ? 'Læser…' : 'Læs igen fra filen'}
          </button>
        )}
        {saved && <span className="text-sm text-ok ml-auto">Gemt og bruges til retningen</span>}
      </div>
    </div>
  );
}
