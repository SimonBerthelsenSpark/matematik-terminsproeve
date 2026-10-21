import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout.jsx';
import { PageHeader, Notice, Spinner } from '../components/ui.jsx';
import { useExams } from '../hooks/useExams.js';
import { getDailyUsage } from '../services/usageService.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { addUsage, totalTokens, formatTokens, formatTokensKort, formatKr, formatUSD, dagNoegle, USD_TIL_DKK } from '../utils/usage.js';

const OPGAVE_NAVNE = {
  gradeMath: 'Retning, matematik',
  gradeDansk: 'Retning, dansk',
  askQuestion: 'Spørg AI',
  explainTask: 'Forklar opgave',
  parseBedoemmelse: 'Læs bedømmelseskema',
  ping: 'Forbindelsestest'
};

const datoTekst = (id) => {
  const [y, m, d] = id.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
};

function Tal({ label, usage, hint }) {
  return (
    <div className="surface p-4">
      <p className="text-[13px] text-ink-soft">{label}</p>
      <p className="num text-[22px] font-semibold leading-tight mt-1">{formatTokensKort(totalTokens(usage))} <span className="text-sm font-normal text-ink-soft">tokens</span></p>
      <p className="text-[13px] text-ink-soft mt-0.5">
        ca. <span className="num" title={formatUSD(usage.cost)}>{formatKr(usage.cost)}</span> · <span className="num">{formatTokens(usage.calls)}</span> kald
      </p>
      {hint && <p className="text-[12px] text-ink-faint mt-1">{hint}</p>}
    </div>
  );
}

/**
 * Forbrug: tokens og anslået pris pr. dag, pr. prøve og i alt.
 */
export function UsagePage() {
  const { exams, loading: loadingExams } = useExams();
  const { erAdmin } = useAuth();
  const [alle, setAlle] = useState(false);
  const [dage, setDage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDage(null);
    setError(null);
    getDailyUsage({ alle }).then(setDage).catch(err => setError(err.message));
  }, [alle]);

  const overblik = useMemo(() => {
    if (!dage) return null;
    const idag = dagNoegle();
    const syvDageSiden = dagNoegle(new Date(Date.now() - 6 * 864e5));
    const maaned = idag.slice(0, 7);
    const opgaver = {};
    for (const d of dage) {
      for (const [task, u] of Object.entries(d.opgaver || {})) opgaver[task] = addUsage(opgaver[task], u);
    }
    return {
      idag: addUsage(dage.find(d => d.id === idag)),
      uge: addUsage(...dage.filter(d => d.id >= syvDageSiden)),
      maaned: addUsage(...dage.filter(d => d.id.startsWith(maaned))),
      ialt: addUsage(...dage),
      opgaver: Object.entries(opgaver).sort((a, b) => b[1].cost - a[1].cost)
    };
  }, [dage]);

  const seneste = (dage || []).slice(0, 30);
  const maxDag = Math.max(1, ...seneste.map(d => totalTokens(d)));

  const proever = useMemo(() => (exams || [])
    .filter(e => e.usage && (e.usage.calls || 0) > 0)
    .map(e => ({ ...e, usage: addUsage(e.usage) }))
    .sort((a, b) => b.usage.cost - a.usage.cost), [exams]);
  const udenForbrug = (exams || []).length - proever.length;

  return (
    <Layout>
      <PageHeader
        title="Forbrug"
        description={`${alle ? 'Alle læreres' : 'Dit'} AI-forbrug i tokens og anslået pris. Prisen er omregnet med ${USD_TIL_DKK} kr. pr. dollar ud fra modellens listepris, så jeres faktura kan afvige lidt.`}
        actions={erAdmin && (
          <div className="inline-flex p-1 rounded-control bg-surface border border-line" role="group" aria-label="Vis forbrug for">
            {[[false, 'Mit forbrug'], [true, 'Alle lærere']].map(([v, label]) => (
              <button key={label} type="button" aria-pressed={alle === v} onClick={() => setAlle(v)}
                className={`px-3 h-8 rounded-[5px] text-sm font-semibold ${alle === v ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'}`}>{label}</button>
            ))}
          </div>
        )}
      />

      {error && <Notice title="Forbruget kunne ikke hentes">{error}</Notice>}

      {!overblik && !error && <div className="py-10 flex justify-center"><Spinner /></div>}

      {overblik && (
        <div className="space-y-8">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Tal label="I dag" usage={overblik.idag} />
            <Tal label="Seneste 7 dage" usage={overblik.uge} />
            <Tal label="Denne måned" usage={overblik.maaned} />
            <Tal label="I alt" usage={overblik.ialt} hint={dage.length ? `Siden ${datoTekst(dage[dage.length - 1].id)}` : undefined} />
          </div>

          <section aria-labelledby="pr-dag">
            <h2 id="pr-dag" className="text-[17px] font-semibold mb-3">Pr. dag</h2>
            {seneste.length === 0 ? (
              <p className="text-sm text-ink-soft">Der er ikke registreret noget forbrug endnu. Forbruget registreres, hver gang AI bruges.</p>
            ) : (
              <div className="surface overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Dato</th>
                      <th className="hidden md:table-cell w-[30%]"><span className="sr-only">Fordeling</span></th>
                      <th className="text-right">Kald</th>
                      <th className="hidden sm:table-cell text-right">Ind</th>
                      <th className="hidden sm:table-cell text-right">Ud</th>
                      <th className="text-right">Tokens</th>
                      <th className="text-right">Pris</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seneste.map(d => (
                      <tr key={d.id}>
                        <td className="whitespace-nowrap">{datoTekst(d.id)}{d.id === dagNoegle() && <span className="ml-2 text-[12px] text-ink-soft">i dag</span>}</td>
                        <td className="hidden md:table-cell">
                          <div className="h-2 rounded-full bg-paper overflow-hidden" aria-hidden="true">
                            <div className="h-full rounded-full bg-ink/70" style={{ width: `${Math.max(2, (totalTokens(d) / maxDag) * 100)}%` }} />
                          </div>
                        </td>
                        <td className="num text-right">{formatTokens(d.calls)}</td>
                        <td className="hidden sm:table-cell num text-right text-ink-soft">{formatTokensKort(d.inputTokens)}</td>
                        <td className="hidden sm:table-cell num text-right text-ink-soft">{formatTokensKort(d.outputTokens)}</td>
                        <td className="num text-right">{formatTokensKort(totalTokens(d))}</td>
                        <td className="num text-right whitespace-nowrap" title={formatUSD(d.cost)}>{formatKr(d.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="pr-proeve">
            <h2 id="pr-proeve" className="text-[17px] font-semibold mb-3">Pr. prøve{alle && <span className="ml-2 text-sm font-normal text-ink-soft">kun dine egne</span>}</h2>
            {loadingExams ? <Spinner /> : proever.length === 0 ? (
              <p className="text-sm text-ink-soft">Ingen prøver med registreret forbrug endnu.</p>
            ) : (
              <div className="surface overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Prøve</th>
                      <th className="text-right">Rettet</th>
                      <th className="text-right">Tokens</th>
                      <th className="text-right">Pris</th>
                      <th className="hidden sm:table-cell text-right">Pr. besvarelse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proever.map(e => {
                      const rettet = e.stats?.gradedCount || 0;
                      return (
                        <tr key={e.id}>
                          <td>
                            <Link to={`/exams/${e.id}`} className="font-medium hover:underline underline-offset-2">{e.beskrivelse || 'Uden titel'}</Link>
                            <span className="block text-[13px] text-ink-soft">{e.type} · {e.klasse}</span>
                          </td>
                          <td className="num text-right">{rettet}</td>
                          <td className="num text-right">{formatTokensKort(totalTokens(e.usage))}</td>
                          <td className="num text-right whitespace-nowrap" title={formatUSD(e.usage.cost)}>{formatKr(e.usage.cost)}</td>
                          <td className="hidden sm:table-cell num text-right whitespace-nowrap">
                            {rettet > 0 ? <>{formatTokensKort(totalTokens(e.usage) / rettet)} · {formatKr(e.usage.cost / rettet)}</> : '–'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-[13px] text-ink-soft">
              Prøvens forbrug omfatter både retning og "Spørg AI".
              {udenForbrug > 0 && ` ${udenForbrug} ${udenForbrug === 1 ? 'prøve' : 'prøver'} uden registreret forbrug vises ikke.`}
            </p>
          </section>

          {overblik.opgaver.length > 0 && (
            <section aria-labelledby="pr-type">
              <h2 id="pr-type" className="text-[17px] font-semibold mb-3">Fordelt på brug</h2>
              <div className="surface overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Brug</th>
                      <th className="text-right">Kald</th>
                      <th className="text-right">Tokens</th>
                      <th className="text-right">Pris</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overblik.opgaver.map(([task, u]) => (
                      <tr key={task}>
                        <td>{OPGAVE_NAVNE[task] || task}</td>
                        <td className="num text-right">{formatTokens(u.calls)}</td>
                        <td className="num text-right">{formatTokensKort(totalTokens(u))}</td>
                        <td className="num text-right whitespace-nowrap" title={formatUSD(u.cost)}>{formatKr(u.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </Layout>
  );
}
