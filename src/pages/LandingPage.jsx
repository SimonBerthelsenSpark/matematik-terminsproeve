import React from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText } from '../components/Icons.jsx';

export const EKSEMPEL_FILER = [
  { fil: 'opgavesaet.pdf', navn: 'Opgavesæt', note: 'Den fiktive prøve, 30 point' },
  { fil: 'rettevejledning.pdf', navn: 'Rettevejledning', note: 'Uploades under Materiale' },
  { fil: 'omsaetningstabel.pdf', navn: 'Omsætningstabel', note: 'Uploades under Materiale' },
  { fil: 'besvarelse-elev-1.pdf', navn: 'Besvarelse, elev 1', note: 'Stærk besvarelse' },
  { fil: 'besvarelse-elev-2.pdf', navn: 'Besvarelse, elev 2', note: 'Middel, med følgefejl' },
  { fil: 'besvarelse-elev-3.pdf', navn: 'Besvarelse, elev 3', note: 'Svag, flere ubesvarede' }
];

function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <rect x="1" y="1" width="20" height="20" rx="5" fill="#1E2B3A" />
      <path d="M6.5 11.5l3 3 6-7" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Topbar til de offentlige sider. */
export function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="bg-surface border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 mr-auto" aria-label="AI Prøveretter – forside">
            <Logo />
            <span className="hidden min-[440px]:inline font-semibold text-[16px] tracking-[-0.01em]">AI Prøveretter</span>
          </Link>
          <Link to="/priser" className="btn-ghost btn-sm">Priser</Link>
          <Link to="/login" className="btn-ghost btn-sm">Log ind</Link>
          <Link to="/opret" className="btn-primary btn-sm">Opret konto</Link>
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row gap-2 sm:items-center text-[13px] text-ink-soft">
          <span className="mr-auto">AI Prøveretter er et støtteværktøj til terminsprøver. Det må ikke bruges til den officielle bedømmelse af folkeskolens prøver.</span>
          <Link to="/priser" className="underline underline-offset-2 hover:text-ink">Priser</Link>
          <Link to="/databehandling" className="underline underline-offset-2 hover:text-ink">Databehandling</Link>
        </div>
      </footer>
    </div>
  );
}

/** Statisk eksempel på en retning – viser idéen uden at hente data. */
function RetningsEksempel() {
  const raekker = [
    ['1.1', '2', '2', null],
    ['1.2', '2', '2', null],
    ['2.2', '3', '1', 'Tjek'],
    ['2.3', '2', '2', null],
    ['3.3', '3', '2', null]
  ];
  return (
    <div className="surface overflow-hidden shadow-[0_12px_40px_rgba(30,43,58,0.10)]" aria-hidden="true">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <span className="font-semibold text-sm">Elev 2</span>
        <span className="text-[12px] text-ink-soft">AI-forslag · venter på din godkendelse</span>
      </div>
      <table className="table text-sm">
        <thead>
          <tr><th>Opgave</th><th className="text-right">Maks</th><th className="text-right">AI</th><th className="text-right">Dine point</th></tr>
        </thead>
        <tbody>
          {raekker.map(([nr, maks, ai, tjek]) => (
            <tr key={nr}>
              <td>
                <span className="font-medium">Opgave {nr}</span>
                {tjek && <span className="ml-2 inline-flex h-5 px-1.5 items-center rounded-full bg-pen-soft text-pen text-[11.5px] font-semibold">Tjek</span>}
              </td>
              <td className="num text-right text-ink-soft">{maks}</td>
              <td className="num text-right">{ai}</td>
              <td className="text-right"><span className="inline-flex h-7 w-14 items-center justify-end px-2 rounded-control border border-line num">{ai}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-4 py-3 border-t border-line bg-paper/60">
        <span className="text-sm"><span className="num font-semibold">17</span> <span className="text-ink-soft">/ 30 point</span></span>
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex h-9 w-12 items-center justify-center rounded-control border-2 border-dashed border-ink-soft num font-semibold">7</span>
          <span className="btn-primary btn-sm pointer-events-none">Godkend karakter</span>
        </span>
      </div>
    </div>
  );
}

const TRIN = [
  ['Læg materialet ind', 'Upload rettevejledning og omsætningstabel. Appen læser tabellen, og du kan rette den.'],
  ['Upload besvarelserne', 'Eleverne har kun nummer og alias. Før upload dækker du navne med sorte felter – kun den dækkede version forlader din computer.'],
  ['Gennemgå og godkend', 'AI retter hver besvarelse to gange uafhængigt og markerer, hvor den er i tvivl. Du ser besvarelsen ved siden af, retter point og godkender karakteren.'],
  ['Giv feedback', 'Print ét ark pr. elev med point, karakter og feedback – eller gem det som PDF.']
];

const TRYGHED = [
  ['Læreren bestemmer', 'AI giver et forslag. Karakteren regnes ud fra omsætningstabellen, og intet er endeligt, før du har godkendt det.'],
  ['Ingen elevnavne', 'Klasser har kun nummer og alias, og navne dækkes på besvarelserne før upload.'],
  ['Kun du ser dine data', 'Login med godkendt konto. Hver lærer ser kun sine egne prøver og klasser.'],
  ['Ikke til træning', 'Data fra appen bruges ikke til at træne AI-modeller, og AI-tjenesten bliver bedt om ikke at gemme svarene.']
];

/**
 * Offentlig forside før login.
 */
export function LandingPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-14 grid gap-10 lg:grid-cols-[1.05fr_1fr] items-center">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Terminsprøver i matematik og dansk</p>
          <h1 className="mt-3 text-[34px] sm:text-[42px] leading-[1.08] font-semibold tracking-[-0.02em]">
            Ret terminsprøver hurtigere – med dig som den, der bedømmer.
          </h1>
          <p className="mt-4 text-[17px] text-ink-soft max-w-xl">
            AI Prøveretter giver et forslag til point, karakter og feedback ud fra jeres egen rettevejledning. Du ser besvarelsen ved siden af, retter det, du er uenig i, og godkender.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/opret" className="btn-primary">Opret konto</Link>
            <a href="#eksempel" className="btn-secondary">Prøv med en eksempelprøve</a>
          </div>
          <p className="mt-3 text-[13px] text-ink-soft">Nye konti godkendes af en administrator, før de kan bruges.</p>
        </div>
        <RetningsEksempel />
      </section>

      {/* Sådan virker det */}
      <section className="bg-surface border-y border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-[24px] font-semibold tracking-[-0.01em]">Sådan virker det</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TRIN.map(([titel, tekst], i) => (
              <li key={titel}>
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-ink text-white text-sm font-semibold num">{i + 1}</span>
                <h3 className="mt-3 font-semibold">{titel}</h3>
                <p className="mt-1 text-sm text-ink-soft">{tekst}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Tryghed */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
          <h2 className="text-[24px] font-semibold tracking-[-0.01em]">Bygget til elevdata</h2>
          <Link to="/databehandling" className="text-sm underline underline-offset-2 text-ink-soft hover:text-ink">Læs om databehandling</Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRYGHED.map(([titel, tekst]) => (
            <div key={titel} className="surface p-5">
              <h3 className="font-semibold">{titel}</h3>
              <p className="mt-1 text-sm text-ink-soft">{tekst}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Eksempelprøve */}
      <section id="eksempel" className="bg-surface border-y border-line scroll-mt-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="text-[24px] font-semibold tracking-[-0.01em]">Prøv med en eksempelprøve</h2>
            <p className="mt-3 text-ink-soft">
              Hent en fiktiv terminsprøve med rettevejledning, omsætningstabel og tre elevbesvarelser på forskellige niveauer. Alle navne er opdigtede, så du kan prøve hele forløbet – også at dække navne – uden at bruge rigtige elevdata.
            </p>
            <ol className="mt-6 space-y-3 text-sm">
              {[
                'Opret en konto, og vent på godkendelse.',
                'Klik "Prøv eksempelprøven" på forsiden i appen. Så oprettes prøve, materiale og en klasse med tre elever automatisk.',
                'Upload de tre besvarelser under Besvarelser, og dæk navnene.',
                'Tryk "Ret", og gennemgå forslagene ved siden af besvarelserne.'
              ].map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="num text-ink-soft w-4 shrink-0">{i + 1}.</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm text-ink-soft">Klar til egne data? Opret en klasse med elevnumre, og start en ny prøve med jeres egen rettevejledning.</p>
          </div>

          <ul className="surface divide-y divide-line self-start" aria-label="Filer i eksempelprøven">
            {EKSEMPEL_FILER.map(f => (
              <li key={f.fil} className="flex items-center gap-3 px-4 py-3">
                <FileText className="w-4 h-4 text-ink-soft shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-sm">{f.navn}</span>
                  <span className="block text-[12.5px] text-ink-soft">{f.note}</span>
                </span>
                <a href={`/eksempel/${f.fil}`} download className="btn-ghost btn-sm" aria-label={`Hent ${f.navn}`}>
                  <Download className="w-4 h-4" /> Hent
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 text-center">
        <h2 className="text-[24px] font-semibold tracking-[-0.01em]">Klar til at prøve?</h2>
        <p className="mt-2 text-ink-soft">Opret en konto med din skole-mail. De første 30 besvarelser er gratis – <Link to="/priser" className="underline underline-offset-2 hover:text-ink">se priser</Link>.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/opret" className="btn-primary">Opret konto</Link>
          <Link to="/login" className="btn-secondary">Log ind</Link>
        </div>
      </section>
    </PublicLayout>
  );
}
