# AI Prøveretter – ændringer

Filerne i denne pakke følger jeres repo-struktur. Kopiér dem ind oven i jeres projekt. Kun ændrede og nye filer er med.

Koden er gendannet fra source map'en i deploy-zip'en. Den nye kode er bygget med Vite, og 55 unit tests er grønne. Alle skærme er gennemklikket med testdata (Firebase og AI udskiftet med en lokal attrap). Den er **ikke** testet mod jeres rigtige Firebase eller OpenAI. Kør den derfor på et deploy preview, før den går i produktion.

## Skal gøres ved deploy

1. **Udskift `netlify/functions/grade-exam.js`** med den nye. Den gamle funktion tog imod frie prompts fra browseren. Den nye tager kun imod faste opgavetyper. Klient og funktion skal derfor deployes samtidig.
2. **Miljøvariabler i Netlify:**
   - `OPENAI_API_KEY` (har I sikkert allerede, men tjek at navnet er det samme)
   - `OPENAI_MODEL` (valgfri, standard `gpt-4o`)
   - `ALLOWED_ORIGINS` (valgfri, hvis I bruger eget domæne, fx `https://retter.minskole.dk`)
   - `OPENAI_TIMEOUT_MS` (valgfri, sæt den lidt under den tidsgrænse, jeres Netlify-plan giver funktioner)
3. **Pakker:** `npm i @fontsource-variable/public-sans` og `npm i -D vitest`. Tilføj `"test": "vitest run"` til scripts i package.json.
   Skriften hostes sammen med appen i stedet for at hentes fra Google Fonts, så skolerne undgår at sende data til Google.
   `tailwind.config.js` og `src/index.css` er erstattet. Har jeres egen config andre `content`-stier end `./index.html` og `./src/**/*.{js,jsx}`, så flet dem ind.
4. **vite.config.js:** Tilføj følgende, så `console.log` med elevdata fjernes i produktion, og kildekoden ikke ligger offentligt:
   ```js
   esbuild: { pure: ['console.log', 'console.debug'] },
   build: { sourcemap: false },
   ```
5. **Firebase Storage-regler:** Permanent sletning af en prøve lister nu alle filer under `exams/{id}/`. Hvis reglerne ikke tillader `list`, falder den tilbage til at slette de kendte filer enkeltvis.

## Design og brugervenlighed (runde 2)

**Arbejdsgangen er samlet.** Hver prøve har tre trin øverst: Materiale → Besvarelser → Retning. Hvert trin viser sin status (✓, antal uploadet, antal godkendt), og der er en "Fortsæt"-knap til næste trin. De tre knapper på forsidekortet er væk.

**Forsiden** er en tabel med fremdrift og kolonnen "Næste skridt" (fx "Ret 2 besvarelser" eller "Gennemse 3 karakterer"). Et klik på rækken går direkte til det trin, der mangler.

**Klasser** har fået deres egen side med klasselisten til venstre og eleverne til højre. Nyt: **Indsæt elevliste**, så hele listen kan kopieres ind fra et regneark i én omgang.

**Besvarelser:**
- Én række pr. elev.
- Nyt: **Upload flere filer**. Filerne matches automatisk til eleverne ud fra navn eller nummer i filnavnet, og du ser en oversigt, før noget uploades.
- Filtypen tjekkes, før der uploades.

**Retning** er en kompakt elevliste i stedet for store kort:
- **Karaktermærket:** stiplet kant = AI-forslag, udfyldt = godkendt af dig. Det samme mærke bruges overalt.
- Klik på en elev for at se opgaverne og rette point direkte i tabellen. Karakteren beregnes live.
- Du godkender med én knap. Derefter **åbnes næste elev, der mangler gennemsyn, automatisk**.
- "Spørg AI" ligger under hver opgave.

**Godkendt-status gemmes nu** (`stats.reviewedCount`), så forsiden og trinene kan vise, hvor mange karakterer læreren har godkendt.

**Visuelt:**
- Rolig "blæk og rettepen"-palet. Rød bruges kun til det, der kræver handling.
- Skriften er Public Sans med tabeltal.
- Ingen emojis og gradienter.
- Toasts nederst til højre.
- Rigtige bekræftelsesdialoger erstatter `window.confirm`.
- Virker på mobil (testet i 390 px bredde).

**Tilgængelighed:**
- Synligt tastaturfokus.
- "Gå til indhold"-link.
- Labels på alle felter.
- Fokus flyttes til første fejl i formularer.
- Respekterer "reducer bevægelse".

**Andre små rettelser:**
- Matriksen viste "–" for karakteren 00 og for alle Dansk-karakterer.
- Statistik blev ikke nulstillet, når den sidste rettelse blev slettet.
- Ikonerne ignorerede deres størrelse.
- Faget kan ikke længere skiftes, efter der er uploadet besvarelser.

**Nye filer:**
- `src/components/ui.jsx`: knapper, felter, karaktermærke og dialog
- `src/components/ExamShell.jsx`: prøvens trin
- `src/pages/ClassesPage.jsx`
- `src/utils/examStatus.js`
- `src/utils/matchFiles.js` (med tests)

**Kan slettes:** `src/hooks/useFileUpload.js` og `src/hooks/useFileHandling.js` bruges ikke længere.

**Tjek ved test:** Denne arbejdsgang er ikke gennemklikket mod jeres rigtige data: upload af rigtige PDF/Word-filer i Besvarelser, "Læs kriterier fra skemaet" for Dansk og Vision-retning.

## Sikkerhed og persondata (uden login)

- **Prompts bygges på serveren.** Funktionen kan ikke længere bruges som gratis OpenAI-proxy til vilkårlige formål. Der er størrelsesgrænser på al input, og kun billeder som data-URL'er accepteres.
- **Origin-tjek:** Kun jeres egne domæner og localhost får svar. Det stopper andre websites, men ikke et script, der forfalsker headeren. Det kræver login.
- **Elevnavne fjernes**, før teksten sendes til AI. Navnet udledes af filnavnet ("12_Søren Hansen" → "[ELEV]"). Det virker ikke på billeder i Vision-tilstand, hvor navnet kan stå på siden.
- **Prompt-injection:** Elevbesvarelsen pakkes ind i tags, og modellen får besked på at behandle den som data, ikke instruktioner.
- **Window-globaler fjernet** (`window.db`, `window.firebase`, `window.mammoth`, `window.pdfjsLib`).
- Ekstra sikkerheds-headers i `netlify.toml`.

**Ikke løst (kræver login):** Firestore og Storage er stadig åbne for alle, der kender projekt-ID'et.

## Karakterberegning

- **Matematik-karakteren beregnes i koden** ud fra omsætningstabellen og kommer aldrig fra AI. Før blev AI'ens karakter brugt, også når totalen var rettet.
- **Fejl i omsætningstabellen rettet:** "- 3" blev læst som 3, så 0 point gav karakteren 3. Halve point (fx 12,5) fandt ingen karakter og gav -3. Opslaget bruger nu "højeste karakter, hvor min-point ≤ point".
- **Ny editor til omsætningstabellen** under Rediger prøve (Matematik). Den kan læse tabellen fra den uploadede fil, læreren kan rette den, og den gemmes som data på prøven (`omsaetningstabelData`). Tabellen valideres. Retningen bruger altid den gemte tabel, når den findes.
- **Point valideres:** Point over `maxPoint` klemmes ned. Der vises en advarsel, hvis summen af `maxPoint` ikke passer med tabellens maksimum. Det tyder på, at AI har overset eller opfundet opgaver. Advarsler vises på elevkortet og gemmes.
- **"/ 75" var hardcodet.** Maksimum beregnes nu ud fra opgaverne.
- **Dansk: kriterier matches på id (K1, K2, …)** og ikke på rækkefølge. En manglende eller ugyldig delkarakter giver en tydelig fejl. Før blev den stille sat til 0.
- **Dansk: vægtet gennemsnit normaliseres** med den faktiske vægtsum. Afrundingen findes nu ét sted (`src/utils/karakter.js`). Der er en konstant `ROUND_TIES_UP` for midtpunkter, fx 5,5. Den står til at runde ned som hidtil. **Tjek reglen for jeres prøver.**
- **Vægttabel:** Summen vises live med advarsel, hvis den ikke er 100 %. Opdateringen muterer ikke længere state, og del-vægten følger kriterierne.
- **Lærerens point pr. opgave forsvandt ved genindlæsning.** Det er rettet.
- **Bedømmelseskema som PDF** virker nu. Før gav det fejlen "ikke implementeret".

## AI-kald

- **Structured outputs** (`json_schema`, `strict`) for retning og skema-parsing. Det fjerner ca. 170 linjer JSON-reparationskode. Afkortede svar meldes som fejl i stedet for at blive "repareret".
- `temperature: 0` for mere ensartet retning.
- Fælles klient (`src/services/aiService.js`) med retry og backoff ved 429, 5xx og timeouts. En timeout prøves højst én gang mere.
- Model og pris er samlet ét sted. Omkostningen gemmes pr. elev og ikke som et gennemsnit.
- **Vision:** Billederne holdes under ca. 4,2 MB samlet, så kaldet ikke rammer Netlifys grænse for request-størrelse. Kvaliteten sænkes efter behov.
- Omsætningstabellen sendes ikke længere til AI, så der bruges færre tokens.

## Robusthed og data

- **Upload overskrev andres filer:** Tjekket for dubletter skete *efter* upload til Storage. Nu sker det før.
- **Filnavne:** æ, ø og å translittereres (ø → oe). Før blev "Søren" til "S_ren".
- **Student Matriks:** Besvarelser matches præcist, så elev "1_Anna" ikke også matcher "1_Anna Marie".
- **Fejlede retninger kan prøves igen.** Før talte de som rettet, og knappen blev deaktiveret.
- `studentCount` og `totalSubmissions` tælles atomisk og tælles ikke dobbelt, når en fil erstattes.
- **Permanent sletning** fjerner nu også bedømmelseskemaer og gamle, erstattede filer. Batches deles op under Firestores grænse på 500 operationer.
- Hvert elevkort hentede alle submissions. Listen sendes nu ned fra forælderen.

## Kodekvalitet og ydelse

- **Ruterne lazy-loades.** pdf.js og mammoth hentes først, når en fil skal læses. Startbundlen er gået fra ca. 1,57 MB til ca. 0,6 MB, målt i et testbyg med de samme biblioteker.
- pdf.js-workeren bundles lokalt i stedet for at hentes fra et CDN.
- Alle `alert()` og `window.confirm` er erstattet med toasts og bekræftelsesdialoger.
- Debug-logs fjernet, blandt andet "SIMON TEST".
- **Tests:** `src/utils/karakter.test.js`, `src/grading.test.js` og `netlify/function-tests/grade-exam.test.js`.

## Ikke gjort (endnu)

- Login og Firestore- og Storage-regler.
- Yderligere opsplitning af `MathExamGrader.jsx`. Visningen er skrevet om og død kode fjernet, men indlæsning og retning ligger stadig samme sted.
- Dobbelt-retning med markering af uenighed. Det koster dobbelt så meget, så det er jeres beslutning.
- Skift af model. Sæt `OPENAI_MODEL` og ret prisen i `MODEL_PRICES`.

## Bemærk

- `ResultsOverview.jsx` blev importeret, men aldrig brugt. Importen er fjernet. Selve filen var ikke med i source map'en, så den ligger stadig i jeres repo.
- `index.css` er ikke ændret og er ikke med i pakken.

## AI-model og instruktioner (runde 3)

- **Model:** `gpt-6.1-sol` i stedet for `gpt-4o`. Den er en ræsonnerende model, som er bedre til flertrins-matematik, og den er billigere pr. input-token ($2 mod $2,50 pr. 1M). Den kan se billeder, understøtter structured outputs og tilbyder EU-dataresidens.
- **Parametre:** Ræsonnerende modeller bruger `max_completion_tokens` og `reasoning_effort` (standard `low` af hensyn til Netlifys tidsgrænse) i stedet for `temperature`/`max_tokens`.
- **Reservemodel:** Afviser OpenAI modellen (400/403/404), prøves `gpt-4o` automatisk én gang.
- **Miljøvariabler:** `OPENAI_MODEL`, `OPENAI_FALLBACK_MODEL` og `OPENAI_REASONING_EFFORT` (low/medium/high). Opstår der timeouts, kan `OPENAI_MODEL=gpt-4o` sættes i Netlify for straks at gå tilbage.
- **Matematik-instruktioner:**
  - følgefejl giver point
  - ligeværdige svar accepteres (brøk/decimal/procent, komma/punktum)
  - point for metode og ikke kun for facit
  - enheder trækkes kun, hvis rettevejledningen kræver det
  - samme nummerering som rettevejledningen
  - manglende tegninger i tekstudtræk giver ikke automatisk 0
- **Dansk-instruktioner:**
  - 7-trinsskalaens officielle betydning
  - begrundelse med eksempel eller citat fra teksten
  - hvert kriterium bedømmes for sig
  - hensyn til alderstrin
- **Usikkerhed:** AI markerer opgaver og kriterier, hvor den er i tvivl, med en begrundelse. Det vises som "Tjek" i retningen og som "Tjek advarsel" i elevlisten.
- **Feedback:** Feedback pr. opgave er nu skrevet til læreren (hvorfor dette pointtal). Den samlede feedback er skrevet til eleven.

## Baggrundsretning (runde 4)

Den ræsonnerende model gav 504-fejl, fordi en synkron Netlify-funktion ikke må køre længe nok. Derfor kører retningen nu som **baggrundsjob**:

1. `grade-start` validerer opgaven, gemmer den midlertidigt i **Netlify Blobs** og starter baggrundsfunktionen. Den svarer straks med et job-id.
2. `grade-run-background` kalder AI og må køre i op til 15 minutter. Elevteksten slettes, så snart AI-kaldet er færdigt.
3. `grade-status` er den funktion, browseren spørger med 2,5 sekunders mellemrum. Resultatet udleveres én gang og slettes derefter.

Retningen bruger `gpt-6.1-sol` med `reasoning_effort: medium`, fordi korrekthed er vigtigere end hastighed. Det kan justeres med `OPENAI_REASONING_EFFORT`. Fælles AI-kode ligger i `netlify/lib/aiCore.js`, og `grade-exam` findes stadig som synkron reserve.

Siden skal være åben, mens der rettes. Kommer et resultat aldrig frem, fx fordi siden blev lukket, ryddes det op efter 16 minutter, når statussen tjekkes.

## Vision altid og dobbeltretning (matematik)

- **Siderne sendes altid som billeder** for matematik (PDF). Indstillingen "Læs tegninger og grafer" er fjernet. Op til 20 sider; ved mere end 12 sider bruges lidt lavere opløsning, så alt holder sig under Netlifys grænse.
- **Hver besvarelse rettes to gange uafhængigt** (parallelt). Første retning bruges som grundlag. Opgaver hvor de to retninger giver forskellige point, eller som kun findes i den ene, markeres "Tjek" med begge pointtal og den anden retnings begrundelse. Fejler den ene retning, bruges den anden med en advarsel.
- Prisen pr. besvarelse er ca. 2 gange den hidtidige (plus billeder for prøver, hvor Vision før var slået fra).

## Besvarelsen ved siden af retningen

- På skærme fra 1024 px vises elevens PDF til venstre og pointene til højre, når en elev åbnes. Kan slås fra med "Skjul besvarelsen" (huskes i browseren).
- AI angiver nu, hvilken side hvert svar står på (`side` i svaret). Siden vises ved opgaven ("s. 3"), og når opgaven åbnes, ruller PDF'en dertil og markerer siden.
- Teksten fra elevens PDF sendes med sidemarkører ([Side N]), og billederne sendes med "Side N" foran.

## Forbrug (tokens og pris)

- **Alt AI-forbrug registreres** (tokens ind/ud, heraf tænkning, antal kald og anslået pris) i `usageDaily/{YYYY-MM-DD}` og på prøven (`exams/{id}.usage`). Tallene lægges til med `increment()`.
- **Pr. besvarelse:** tokens og pris vises under karakteren (gemmes som `aiGrading.usage`). Ældre retninger viser kun prisen.
- **Pr. prøve:** nederst på Retning ("AI-forbrug for prøven … gns. pr. besvarelse").
- **Ny side "Forbrug"** i menuen: i dag, seneste 7 dage, denne måned og i alt, en tabel pr. dag, pr. prøve og fordelt på brug.
- Prisen vises i kroner med en fast kurs på 7 kr. pr. dollar (`USD_TIL_DKK` i `src/utils/usage.js`) ud fra `MODEL_PRICES`.
- "Slet alle data" sletter også forbrugsoversigten.

## Retningen fortsætter ved sideskift

- Retningen registreres globalt (`src/services/gradingRuns.js`) og fortsætter, selvom læreren går til en anden side i appen. Ved tilbagekomst vises fremdriften igen, og de færdige elever er med.
- En mørk bjælke under menuen viser "Retter … X af Y" på alle andre sider med et link tilbage til retningen.
- Hver elev gemmes i databasen, så snart den er rettet (før skete det først til sidst), så intet går tabt, hvis noget går galt undervejs.
- Browseren advarer, hvis man prøver at lukke eller genindlæse fanen, mens der rettes. En genindlæsning stopper retningen, men allerede rettede elever er gemt, og "Ret" fortsætter med resten.

## Retningen fortsætter efter genindlæsning

- Igangværende AI-job huskes i browseren (`aiJob:*` i localStorage, `resumeKey` i `callAI`). Genindlæses siden, hentes jobbet fra serveren i stedet for at starte forfra (serveren gemmer resultatet i ca. 16 min).
- Den igangværende retning huskes (`aiRetning:{examId}`). Når prøven åbnes igen, fortsætter retningen automatisk med de manglende elever.
- På andre sider vises "Retningen af … blev afbrudt" med "Fortsæt retningen" og "Fortsæt ikke".
- Kortvarige netværksudfald under ventetiden stopper ikke længere en elev.

## Login og databeskyttelse

- **Login med e-mail og adgangskode** (Firebase Auth) med bekræftet e-mail. Kun lærere godkendt af en administrator (`brugere/{email}`) får adgang. Faste administratorer: `src/config/admins.js`.
- **Hver lærer ser kun sine egne data:** prøver, klasser og forbrug får `ownerUid`, og alle forespørgsler filtrerer på den. `firestore.rules` og `storage.rules` håndhæver det i databasen.
- **AI-funktionerne kræver login:** `grade-start`, `grade-status` og `grade-exam` verificerer lærerens Firebase ID-token (nøgler fra Google, via `jose`) og at læreren er godkendt. Et job kan kun hentes af den lærer, der startede det.
- **Elevnavne fjernes fra billederne:** navnet dækkes med sorte felter, hvor det står som tekst i PDF'en. Valgfrit: "Dæk toppen af første side" til håndskrevne navne (Rediger prøve). Translittererede navne (Soeren → Søren) findes også.
- Ingen elevnavne i browserens lager (job-nøgler hashes).
- OpenAI: `store: false` og mulighed for EU-endpoint via `OPENAI_BASE_URL`.
- Ny side **Databehandling** (Indstillinger → Læs mere) til lærere, ledelse og DPO.
- Indstillinger: konto, lærere (administratorer), overtagelse af data fra før login, "Slet alle mine data".
- Elevfilerne er fjernet fra repoets historik.
- Se **OPSAETNING-LOGIN.md** for trinene i Firebase, Netlify og GitHub.

## Anonymisering før upload og kun nummer/alias

- **Klasser:** kun elevnummer og alias (standard "Elev N"). "Opret flere elever" laver N elever på én gang. "Erstat navne med 'Elev' + nummer" fjerner rigtige navne fra ældre klasser.
- **Upload:** hver PDF gennemses i en ny visning, før den uploades. Appen foreslår sorte felter (alias, "Navn:"-linjer, plads til håndskrevet navn, toppen af scannede sider). Læreren kan trække nye felter, fjerne felter og fortryde.
- **Kun den anonymiserede PDF forlader computeren:** siderne gemmes som billeder med felterne brændt ind, og kun tekst, der ikke er dækket, lægges usynligt ind (så appen stadig kan læse teksten). Originalens filnavn gemmes ikke.
- Ældre besvarelser vises med "Anonymisér", så de kan gennemses og erstattes.
- Ny afhængighed: `pdf-lib`.

## Uafhængig rulning ved siden af besvarelsen

- Når en elev åbnes med besvarelsen ved siden af, fylder de to vinduer skærmens højde og ruller hver for sig. Besvarelsen bliver stående, mens man ruller ned gennem opgaver, karakter og feedback.

## Ret alias

- Under Klasser kan en elevs alias rettes direkte: klik på aliaset eller blyanten, skriv, og tryk Enter (Esc fortryder). Tomt felt giver "Elev" + nummer. Besvarelser følger eleven via nummeret.
- På Besvarelser vises "Åbn besvarelse" i stedet for filnavnet, så gamle filnavne med rigtige navne ikke vises.

## Print feedback til eleverne

- "Print feedback" på Retning (hele klassen) og "Print feedback til eleven" ved hver elev. Ét A4-ark pr. elev med prøve, elevnummer/alias, karakter, point pr. opgave (dansk: delkarakter pr. kriterium), evt. kommentar pr. opgave og feedback til eleven.
- Valg: kun godkendte karakterer (ikke-godkendte markeres "foreløbig") og om kommentarer pr. opgave skal med. Lærerens rettede point og karakter bruges, når de findes.
- "Gem som PDF" i printdialogen giver en PDF til digital deling.

## Forside før login og eksempelprøve

- **Offentlig forside** (`/`) for besøgende, der ikke er logget ind: hvad appen gør, sådan virker det, elevdata, eksempelprøve og "Opret konto"/"Log ind" (`/login`, `/opret`). Siden Databehandling kan også læses uden login.
- **Fiktiv eksempelprøve** i `public/eksempel/`: opgavesæt, rettevejledning, omsætningstabel (30 point) og tre besvarelser på forskellige niveauer med opdigtede navne. Laves med `python3 scripts/lav-eksempelproeve.py`.
- **"Prøv eksempelprøven"** på forsiden i appen opretter klassen "Eksempel 9.X" med tre elever, prøven og materialet. Under Besvarelser vises links til de tre besvarelser, så læreren selv prøver upload og anonymisering.
- Rettet: ord som "navne" og "navnet" blev fejlagtigt dækket som en "Navn:"-linje.
