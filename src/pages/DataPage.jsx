import React from 'react';
import { Layout } from '../components/Layout.jsx';
import { PageHeader } from '../components/ui.jsx';

const Blok = ({ title, children }) => (
  <section className="surface p-5">
    <h2 className="text-[17px] font-semibold mb-2">{title}</h2>
    <div className="text-sm text-ink-soft space-y-2 max-w-prose [&_strong]:text-ink [&_strong]:font-semibold">{children}</div>
  </section>
);

/**
 * Hvordan elevdata behandles – til lærere, ledelse og databeskyttelsesrådgiver.
 * Holdes kort og faktuel; skal opdateres, hvis dataflowet ændres.
 */
export function DataPage() {
  return (
    <Layout width="narrow">
      <PageHeader
        title="Databehandling"
        description="Hvilke oplysninger appen behandler, hvor de ligger, og hvor længe. Siden kan bruges som grundlag for skolens oversigt over AI-systemer og konsekvensanalyse."
      />
      <div className="space-y-4">
        <Blok title="Hvad appen bruges til">
          <p>Læreren får et <strong>forslag</strong> til point og karakter for terminsprøver i matematik og dansk. AI træffer ingen afgørelser: <strong>læreren gennemgår og godkender altid karakteren</strong>, og godkendelsen gemmes. Karakteren beregnes ud fra skolens omsætningstabel, ikke af AI.</p>
          <p>Appen må ikke bruges til den officielle bedømmelse af folkeskolens prøver.</p>
        </Blok>

        <Blok title="Oplysninger der behandles">
          <p><strong>Om elever:</strong> elevnummer og et alias (ikke rigtige navne), den anonymiserede besvarelse, point, karakterer og feedback. Koblingen mellem nummer og elev findes kun hos læreren, uden for appen.</p>
          <p><strong>Anonymisering før upload:</strong> læreren gennemser hver besvarelse og dækker navn og andet, der kan afsløre eleven, med sorte felter. Appen laver en ny PDF, hvor felterne er brændt ind, og tekst under felterne er fjernet. Kun den version uploades – originalen bliver på lærerens computer.</p>
          <p><strong>Om lærere:</strong> e-mail og AI-forbrug.</p>
          <p>Appen behandler ikke følsomme oplysninger, og eleverne bruger ikke appen selv.</p>
        </Blok>

        <Blok title="Hvem har adgang">
          <p>Kun lærere med bekræftet e-mail, som en administrator har godkendt. <strong>Hver lærer ser kun sine egne prøver, klasser og elever.</strong> Det håndhæves af databasens sikkerhedsregler, ikke kun af appen.</p>
        </Blok>

        <Blok title="Hvad der sendes til AI (OpenAI)">
          <p>Ved retning sendes rettevejledningen, elevens tekst og billeder af siderne.</p>
          <p>AI'en får kun den anonymiserede besvarelse – uden navn, filnavn og elevnummer. OpenAI kan derfor ikke med rimelighed finde ud af, hvem eleven er. Som ekstra sikring dækkes elevens alias også automatisk, hvis det står i besvarelsen.</p>
          <p>OpenAI bruger ikke data fra API'et til at træne modeller, og appen beder om, at svarene ikke gemmes. Når appen bruger et OpenAI-projekt med europæisk dataopbevaring, behandles forespørgslerne i Europa og gemmes ikke.</p>
        </Blok>

        <Blok title="Hvor data ligger, og hvor længe">
          <p><strong>Google Firebase</strong> (database og filer): prøver, besvarelser, rettelser og klasser – indtil læreren sletter dem. Læreren kan slette en prøve eller alle sine data under Indstillinger.</p>
          <p><strong>Netlify</strong> (hosting og AI-funktioner): mens en besvarelse rettes, ligger opgaven midlertidigt på serveren. Den slettes, når retningen er kørt, og resultatet slettes, når appen har hentet det – senest efter ca. 16 minutter.</p>
          <p><strong>Lærerens browser:</strong> igangværende retninger huskes uden elevnavne, så en retning kan fortsætte efter en genindlæsning.</p>
        </Blok>

        <Blok title="Leverandører (underdatabehandlere)">
          <p>Google (Firebase), Netlify og OpenAI. Alle tre er amerikanske virksomheder, så skolen skal vurdere grundlaget for overførsel til tredjelande som en del af databehandleraftalen.</p>
        </Blok>
      </div>
    </Layout>
  );
}
