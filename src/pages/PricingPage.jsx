import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from './LandingPage.jsx';
import { Check } from '../components/Icons.jsx';

/** Kontakt til skoler og kommuner. Ret her. */
export const KONTAKT_EMAIL = 'simonberthelsen@hotmail.com';

/**
 * Prismodel (ekskl. moms). Bygget på en kostpris på ca. 2–3 kr. pr. rettet besvarelse
 * (to uafhængige AI-retninger med billeder af siderne).
 */
const PLANER = [
  {
    id: 'proev',
    navn: 'Prøv',
    til: 'Se, om det passer til din måde at rette på',
    pris: { md: '0 kr.', aar: '0 kr.' },
    prisNote: 'Ingen betalingsoplysninger',
    punkter: [
      'Eksempelprøve med fiktive besvarelser',
      '30 besvarelser med dine egne data',
      'Alle funktioner, inkl. anonymisering og print',
      'Matematik og dansk'
    ],
    cta: { tekst: 'Opret konto', til: '/opret' }
  },
  {
    id: 'laerer',
    navn: 'Lærer',
    til: 'Til dig, der vil i gang nu – også uden skolens licens',
    pris: { md: '99 kr.', aar: '990 kr.' },
    prisNote: { md: 'pr. måned', aar: 'pr. år – svarer til 2 måneder gratis' },
    punkter: [
      '250 besvarelser pr. år – ca. 10 klassesæt',
      'Ekstra 100 besvarelser for 349 kr.',
      'Besvarelsen ved siden af pointene',
      'Print af elevfeedback og forbrugsoversigt',
      'Opsig når som helst'
    ],
    fremhaevet: true,
    cta: { tekst: 'Kom i gang', til: '/opret' }
  },
  {
    id: 'skole',
    navn: 'Skole',
    til: 'Alle lærere i udskolingen på én aftale',
    pris: { md: '49 kr.', aar: '49 kr.' },
    prisNote: { md: 'pr. elev pr. år (7.–9. klasse)', aar: 'pr. elev pr. år (7.–9. klasse)' },
    punkter: [
      'Ubegrænset antal lærere',
      'Op til 10 besvarelser pr. elev pr. år',
      'Skolen godkender og fjerner lærere selv',
      'Databehandleraftale og dokumentation til konsekvensanalyse',
      'Introduktion for lærerne og faktura med EAN',
      'Minimum 150 elever'
    ],
    cta: { tekst: 'Kontakt os', mail: 'Skolelicens til AI Prøveretter' }
  }
];

const FAQ = [
  ['Hvad tæller som én besvarelse?', 'Én elevs besvarelse af én prøve, når den er rettet. Appen retter hver besvarelse to gange for at finde usikre opgaver – det tæller stadig som én. Retter du den samme besvarelse forfra, tæller den igen. Spørgsmål til AI om en opgave er gratis.'],
  ['Hvad sker der, hvis jeg bruger alle besvarelserne?', 'Du får besked, før du løber tør, og kan købe en ekstra pakke. Dine prøver, rettelser og karakterer bliver liggende.'],
  ['Kan skolen betale for en enkelt lærer?', 'Ja. Lærer-planen kan faktureres til skolen med EAN-nummer. Når flere lærere vil bruge appen, er skolelicensen som regel billigere.'],
  ['Hvordan regnes skolelicensen?', 'Ud fra antallet af elever i 7.–9. klasse. 300 elever koster 14.700 kr. om året ekskl. moms, uanset hvor mange lærere der bruger appen.'],
  ['Hvad med GDPR?', 'Eleverne har kun nummer og alias i appen, og navne dækkes, før besvarelser uploades. Skolen får en databehandleraftale og en beskrivelse af dataflowet til sin konsekvensanalyse.'],
  ['Hvorfor er der et loft over antal besvarelser?', 'Hver retning bruger en grundig AI-model, som koster penge pr. side. Loftet gør prisen forudsigelig for jer og bæredygtig for os. Det dækker typisk 3–4 terminsprøver i to fag om året.']
];

function Plan({ plan, periode }) {
  const pris = plan.pris[periode];
  const note = typeof plan.prisNote === 'string' ? plan.prisNote : plan.prisNote[periode];
  return (
    <div className={`surface p-6 flex flex-col ${plan.fremhaevet ? 'ring-2 ring-ink relative' : ''}`}>
      {plan.fremhaevet && (
        <span className="absolute -top-3 left-6 inline-flex h-6 px-2.5 items-center rounded-full bg-ink text-white text-[12px] font-semibold">Anbefalet til den enkelte lærer</span>
      )}
      <h2 className="text-[19px] font-semibold">{plan.navn}</h2>
      <p className="mt-1 text-sm text-ink-soft min-h-[2.5rem]">{plan.til}</p>
      <p className="mt-5">
        <span className="num text-[34px] font-semibold tracking-[-0.02em]">{pris}</span>
      </p>
      <p className="text-[13px] text-ink-soft min-h-[2.5rem]">{note}</p>
      <ul className="mt-5 space-y-2.5 text-sm flex-1">
        {plan.punkter.map(p => (
          <li key={p} className="flex gap-2.5">
            <Check className="w-4 h-4 mt-0.5 shrink-0 text-ok" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {plan.cta.mail ? (
          <a href={`mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent(plan.cta.mail)}`} className="btn-secondary w-full">{plan.cta.tekst}</a>
        ) : (
          <Link to={plan.cta.til} className={`${plan.fremhaevet ? 'btn-primary' : 'btn-secondary'} w-full`}>{plan.cta.tekst}</Link>
        )}
      </div>
    </div>
  );
}

/** Udregner til skolelicens. */
function SkoleBeregner() {
  const [elever, setElever] = useState(300);
  const n = Math.max(150, Number(elever) || 0);
  const pris = n * 49;
  const nf = new Intl.NumberFormat('da-DK');
  return (
    <div className="surface p-5 flex flex-col sm:flex-row sm:items-end gap-4">
      <div>
        <label htmlFor="antal-elever-pris" className="field-label">Elever i 7.–9. klasse</label>
        <input id="antal-elever-pris" className="input num w-40" inputMode="numeric" value={elever} onChange={(e) => setElever(e.target.value.replace(/\D/g, ''))} />
      </div>
      <p className="text-sm text-ink-soft sm:pb-2.5 flex-1">
        Skolelicens: <span className="num font-semibold text-ink text-[17px]">{nf.format(pris)} kr.</span> om året ekskl. moms
        {Number(elever) < 150 && ' (minimum 150 elever)'} – ca. <span className="num">{nf.format(Math.round(pris / 12))}</span> kr. om måneden.
      </p>
    </div>
  );
}

export function PricingPage() {
  const [periode, setPeriode] = useState('aar');
  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-6 text-center">
        <h1 className="text-[34px] sm:text-[40px] leading-[1.1] font-semibold tracking-[-0.02em]">Priser</h1>
        <p className="mt-3 text-[17px] text-ink-soft max-w-2xl mx-auto">
          Start gratis. Køb selv som lærer, eller lad skolen dække alle lærere i udskolingen. Alle priser er ekskl. moms.
        </p>
        <div className="mt-6 inline-flex p-1 rounded-control bg-surface border border-line" role="group" aria-label="Betalingsperiode">
          {[['md', 'Månedlig'], ['aar', 'Årlig']].map(([v, label]) => (
            <button key={v} type="button" aria-pressed={periode === v} onClick={() => setPeriode(v)}
              className={`px-4 h-8 rounded-[5px] text-sm font-semibold ${periode === v ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'}`}>
              {label}{v === 'aar' && <span className={`ml-1.5 text-[12px] font-normal ${periode === v ? 'text-white/80' : 'text-ok'}`}>spar 17 %</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 grid gap-6 lg:grid-cols-3 pt-4">
        {PLANER.map(p => <Plan key={p.id} plan={p} periode={periode} />)}
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <h2 className="text-[19px] font-semibold mb-3">Hvad koster det for jeres skole?</h2>
        <SkoleBeregner />
        <p className="mt-3 text-sm text-ink-soft">
          Kommuner og flere skoler sammen: <a href={`mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent('Kommuneaftale for AI Prøveretter')}`} className="underline underline-offset-2 hover:text-ink">kontakt os</a> om en samlet aftale med fælles databehandleraftale og central fakturering.
        </p>
      </section>

      <section className="bg-surface border-y border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-[24px] font-semibold tracking-[-0.01em]">Spørgsmål om priser</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="cursor-pointer list-none flex justify-between gap-4 font-semibold">
                  {q}
                  <span className="text-ink-soft group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
                </summary>
                <p className="mt-2 text-sm text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-center">
        <h2 className="text-[24px] font-semibold tracking-[-0.01em]">Prøv det på en rigtig terminsprøve</h2>
        <p className="mt-2 text-ink-soft">30 besvarelser er gratis – nok til en hel klasse.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/opret" className="btn-primary">Opret konto</Link>
          <a href="/#eksempel" className="btn-secondary">Se eksempelprøven</a>
        </div>
      </section>
    </PublicLayout>
  );
}
