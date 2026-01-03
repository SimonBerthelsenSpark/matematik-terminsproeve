# Matematik Rettesystem - Nuværende Funktionalitet og Dansk Prøver Plan

## Nuværende System (Matematik Prøver)

### 1. Klasseadministration
- **Komponenter**: `ClassManagement.jsx`, `classService.js`
- **Funktionalitet**:
  - Opret ubegrænset antal klasser
  - Hver klasse indeholder unikke elever med elevnummer og navn
  - Håndtering af studerende via subcollection: `classes/{classId}/students`

### 2. Prøveoprettelse
- **Komponenter**: `CreateExamPage.jsx`, `useExams.js`
- **Funktionalitet**:
  - Opret ubegrænset antal prøver
  - Hver prøve tilknyttes én klasse
  - Understøtter både eksisterende og nye klassnavne
  - Type: "Matematik" eller "Dansk"
  - Metadata: beskrivelse, dato, klasse, type

### 3. Matematik: Upload af filer
- **Rettevejledning**: PDF/Word dokument der beskriver opgaver og point-fordeling
- **Omsætningstabel**: PDF/Word/Excel der mapper point til karakter
- **Elevbesvarelser**: 
  - Via `StudentMatrixPage.jsx` - én besvarelse per elev
  - Accepterer PDF og Word (.pdf, .doc, .docx)
  - Filnavne: `{elevnummer}_{elevnavn}.{extension}`

### 4. Matematik: AI-Rettelse
- **Komponent**: `MathExamGrader.jsx`, `useGradingLogic.js`
- **Funktionalitet**:
  - Retter KUN urættede besvarelser
  - Allerede rettede opgaver springes over
  - Hver besvarelse får kun én AI-rettelse
  - AI analyserer hver delopgave individuelt
  - Gemmes i: `exams/{examId}/submissions/{submissionId}/gradingResults/{resultId}`

### 5. Matematik: Lærer Justering
- **Komponent**: `StudentResult.jsx`, `OpgaveDetails.jsx`
- **Funktionalitet**:
  - Vis AI's vurdering (point og karakter for hver delopgave)
  - Lærer kan justere point for hver delopgave
  - Gem ændringer → automatisk beregning af ny karakter
  - Både AI og lærer resultater vises side om side

### 6. Matematik: Resultat Visning
- **Komponenter**: `StudentMatrixPage.jsx`, `StudentResult.jsx`
- **Funktionalitet**:
  - Tabelvisning med:
    - AI Karakter
    - Lærer Karakter
    - Status (uploadet/rettet)
  - Delopgaver ekspanderbar visning
  - Export/download funktioner

### 7. Matematik: Slet og Re-upload
- **Funktionalitet**:
  - Slet besvarelse → fjerner også rettelser
  - Re-upload → ny fil erstatter gammel
  - Genrettelse → kun urættede besvarelser rettes

---

## Ny Funktionalitet: Dansk Prøver

### Forskelle fra Matematik

| Aspekt | Matematik | Dansk |
|--------|-----------|-------|
| **Rettevejledning** | Opgaveliste med point | Bedømmelsesskema med kriterier |
| **Opgavestruktur** | Individuelle delopgaver (1, 2a, 2b, etc.) | Del B (formelle krav) + Del C (fristilen) |
| **Point system** | Direkte point per opgave | Vægtede scorer baseret på delkarakterer |
| **Feedback niveau** | Per delopgave | Per kriterium i hver del |

### Dansk Bedømmelsesfil Format (DYNAMISK EKSEMPEL)

**VIGTIG:** Dette er KUN et eksempel! Systemet skal kunne håndtere ALLE typer af bedømmelsesskemaer.

**Eksempel struktur (kan variere):**

```
Del B: Formelle krav (30% vægt)
├── Genre & layout (7,5%)
├── Modtagerrettethed (7,5%)
├── Struktur (6%)
└── Sprog & korrekthed (9%)

Del C: Fristilen (70% vægt)
├── Opgavebesvarelse & indhold (21%)
├── Argumentation & perspektiv (17,5%)
├── Struktur & sammenhæng (14%)
└── Sprog & stil (17,5%)
```

**Andre mulige strukturer:**
- Kun Del C (100%)
- Del A (20%), Del B (30%), Del C (50%)
- Forskellige kriterie-navne og vægte
- Flere eller færre kriterier per del

**Beregning (generisk):**
```
For hvert kriterium i hver del:
  Vægtet score = (Del-karakter × Vægt) / 100

For hver del:
  Del total = Sum af alle vægtede scorer i den del

Endelig karakter = Sum af alle del-totals
Afrundet karakter = Nærmeste karakter på 7-trins skala
```

**Nøglepunkt:** Parseren og AI skal læse bedømmelseskemaet og tilpasse sig til den specifikke struktur!

### Filstruktur for Dansk Prøver (DYNAMISK)

```
exams/{examId}/
├── bedoemmelseskemaRef (i stedet for rettevejledningRef)
│   ├── storagePath: "exams/{examId}/bedoemmelseskema.docx"
│   ├── fileName: "Dansk - bedømmelse.docx"
│   └── contentType: "application/vnd.openxmlformats..."
│
├── parsedBedoemmelse (cached parsed data fra bedømmelsesskema)
│   └── dele: [
│         {
│           navn: "Del B: Formelle krav",
│           totalVaegt: 30,
│           kriterier: [...]
│         },
│         {
│           navn: "Del C: Skriftlig fremstilling",
│           totalVaegt: 70,
│           kriterier: [...]
│         }
│       ]
│
└── submissions/{submissionId}/
    └── gradingResults/{resultId}
        ├── submissionId
        ├── elevNavn
        ├── aiGrading:
        │   ├── dele: [  // DYNAMISK ARRAY - ikke hardcoded delB/delC
        │   │     {
        │   │       navn: "Del B: Formelle krav",
        │   │       totalVaegt: 30,
        │   │       kriterier: [
        │   │         {
        │   │           navn: "Genre & layout",
        │   │           vaegt: 7.5,
        │   │           delKarakter: 7,
        │   │           vaegtetScore: 0.53,
        │   │           feedback: "..."
        │   │         },
        │   │         ...
        │   │       ],
        │   │       delTotal: 1.84
        │   │     },
        │   │     {
        │   │       navn: "Del C: Skriftlig fremstilling",
        │   │       totalVaegt: 70,
        │   │       kriterier: [...],
        │   │       delTotal: 4.38
        │   │     }
        │   │   ]
        │   ├── samletKarakter: 6.22
        │   ├── afrundetKarakter: 7
        │   └── karakterBegrundelse: "..."
        │
        └── lærerGrading: (samme dynamiske struktur)
```

**Nøgle ændringer:**
- ✅ `parsedBedoemmelse` gemmes med exam for at undgå re-parsing
- ✅ `dele` er et ARRAY - ikke hardcoded `delB` og `delC` properties
- ✅ Struktur tilpasser sig automatisk til bedømmelseskemaets opbygning

---

## Implementation Plan for Dansk Prøver

### Phase 1: Bedømmelsesfil Upload
**Filer at ændre:**
- `CreateExamPage.jsx` - Betinget visning af fil-upload baseret på exam.type
- `EditExamPage.jsx` - Samme betingede logik
- `MathExamGrader.jsx` - Vis bedømmelsesskema i stedet for rettevejledning for dansk

**Logik:**
```javascript
if (exam.type === 'Matematik') {
  // Upload rettevejledning + omsætningstabel
} else if (exam.type === 'Dansk') {
  // Upload KUN bedømmelseskema
  // INGEN omsætningstabel
}
```

### Phase 2: Dansk Bedømmelsesparser (DYNAMISK)
**Ny fil:** `src/utils/danskBedoemmelsesParser.js`

**Funktioner:**
```javascript
/**
 * Parse dansk bedømmelsesfil dynamisk og udtræk ALLE dele og kriterier
 * @param {Blob} file - Bedømmelsesfil
 * @returns {Object} { dele: [...] } - Dynamisk struktur
 */
export async function parseDanskBedoemmelse(file) {
  // 1. Udtræk tekst fra Word/PDF (mammoth.js eller pdf-parse)
  
  // 2. DYNAMISK IDENTIFIKATION af dele
  //    - Find alle sektioner der matcher mønster: "Del X: ..." eller lignende
  //    - Udtræk total vægt for hver del (hvis angivet)
  
  // 3. For hver identificeret del:
  //    - Find alle kriterier med procentsatser
  //    - Udtræk kriteriets navn og vægt
  //    - Udtræk den fulde tekstbeskrivelse af kriteriet
  
  // 4. Valider: Sum af alle vægte = 100%
  
  // 5. Returner struktureret, dynamisk data:
  return {
    dele: [
      {
        navn: "Dynamisk læst navn",
        totalVaegt: 30, // Beregnet eller læst
        kriterier: [
          {
            navn: "Dynamisk kriterienavn",
            vaegt: 7.5,
            beskrivelse: "Fuld beskrivelse fra dokumentet..."
          }
        ]
      }
    ]
  };
}

/**
 * Gem parsed bedømmelse med exam for cache
 */
export async function saveParsedBedoemmelse(examId, parsedData) {
  // Gem til Firestore sammen med exam
  // Undgår re-parsing for hver elevbesvarelse
}
```

**Nøglepunkter:**
- ✅ INGEN hardcoded "Del B" eller "Del C" i koden
- ✅ Finder automatisk alle dele uanset navngivning
- ✅ Udtræk fuld beskrivelse af hvert kriterium
- ✅ Robust error handling hvis format ikke genkendes

### Phase 3: AI Bedømmelse for Dansk (DYNAMISK)
**Ny fil:** `src/hooks/useDanskGrading.js`

**Funktioner:**
```javascript
/**
 * Bed AI om at bedømme dansk opgave DYNAMISK baseret på parsede kriterier
 * @param {Object} parsedBedoemmelse - Dynamisk parsede kriterier fra bedømmelsesskema
 * @param {string} elevbesvarelse - Elevens tekst
 * @returns {Object} Bedømmelse per kriterium i dynamisk struktur
 */
export async function bedoemDanskOpgave(parsedBedoemmelse, elevbesvarelse) {
  // 1. Generer dynamisk prompt baseret på parsedBedoemmelse
  const prompt = generateDynamicPrompt(parsedBedoemmelse, elevbesvarelse);
  
  // 2. Send til AI (OpenAI GPT-4)
  const aiResponse = await callOpenAI(prompt);
  
  // 3. Parse AI's JSON response
  const aiGrading = JSON.parse(aiResponse);
  
  // 4. For hver del:
  //    For hvert kriterium:
  //      Beregn vægtet score = (delKarakter × vægt) / 100
  //    Beregn del-total = sum af vægtede scorer
  
  // 5. Beregn samlet karakter = sum af alle del-totals
  
  // 6. Afrund til nærmeste 7-trins karakter (-3, 00, 02, 4, 7, 10, 12)
  
  // 7. Returner i SAMME dynamiske struktur som parsedBedoemmelse
  return {
    dele: parsedBedoemmelse.dele.map((del, delIdx) => ({
      navn: del.navn,
      totalVaegt: del.totalVaegt,
      kriterier: del.kriterier.map((krit, kritIdx) => {
        const aiKrit = aiGrading.dele[delIdx].kriterier[kritIdx];
        return {
          navn: krit.navn,
          vaegt: krit.vaegt,
          delKarakter: aiKrit.delKarakter,
          vaegtetScore: (aiKrit.delKarakter * krit.vaegt) / 100,
          feedback: aiKrit.feedback
        };
      }),
      delTotal: /* beregn sum af vægtede scorer */
    })),
    samletKarakter: /* sum af alle del-totals */,
    afrundetKarakter: /* afrundet til 7-trins skala */,
    karakterBegrundelse: aiGrading.samletVurdering
  };
}

/**
 * Generer dynamisk prompt baseret på bedømmelseskema
 */
function generateDynamicPrompt(parsedBedoemmelse, elevbesvarelse) {
  // Se eksempel i "AI Prompt for Dansk" sektionen
}
```

**Nøglepunkter:**
- ✅ Prompt oprettes DYNAMISK fra parsede data
- ✅ AI får præcise beskrivelser fra bedømmelseskemaet
- ✅ Return struktur matcher input struktur
- ✅ Virker med alle bedømmelsesskemaer

### Phase 4: Dansk Resultat Visning (DYNAMISK RENDERING)
**Ny komponent:** `src/components/DanskStudentResult.jsx`

**VIGTIG:** Komponenten skal være FULDT DYNAMISK og ikke antage antal dele eller kriterier!

**Pseudo-kode for rendering:**
```jsx
function DanskStudentResult({ result, parsedBedoemmelse }) {
  return (
    <div>
      <h3>{result.elevNavn}</h3>
      
      {/* AI's Vurdering */}
      <div className="ai-vurdering">
        <h4>🤖 AI's Vurdering</h4>
        
        {/* DYNAMISK: Render hver del */}
        {result.aiGrading.dele.map((del, delIdx) => (
          <div key={delIdx} className="del-sektion">
            <h5>{del.navn} ({del.totalVaegt}%)</h5>
            
            {/* DYNAMISK: Render hvert kriterium */}
            {del.kriterier.map((krit, kritIdx) => (
              <div key={kritIdx} className="kriterium">
                <span>{krit.navn}: </span>
                <span className="karakter">{krit.delKarakter}</span>
                <span className="score">({krit.vaegtetScore.toFixed(2)})</span>
                <p className="feedback">{krit.feedback}</p>
              </div>
            ))}
            
            <div className="del-total">
              Total for {del.navn}: {del.delTotal.toFixed(2)}
            </div>
          </div>
        ))}
        
        <div className="samlet">
          Endelig karakter: {result.aiGrading.samletKarakter.toFixed(2)}
          ≈ {result.aiGrading.afrundetKarakter}
        </div>
      </div>
      
      {/* Lærerens Vurdering - SAMME dynamiske struktur */}
      <div className="laerer-vurdering">
        <h4>👨‍🏫 Lærerens Vurdering</h4>
        {/* Samme map-struktur men med edit funktionalitet */}
      </div>
    </div>
  );
}
```

**Layout eksempel (vil variere efter bedømmelsesskema):**
```
┌─────────────────────────────────────┐
│ [Elevnavn]                          │
├─────────────────────────────────────┤
│ 🤖 AI's Vurdering                   │
│ {parsedBedoemmelse.dele.map(del =>  │
│   ┌─────────────────────────────┐   │
│   │ {del.navn} ({del.totalVaegt}%)│ │
│   │ {del.kriterier.map(krit =>   │   │
│   │   ├─ {krit.navn}: {delKar}   │   │
│   │ )}                           │   │
│   │ Total: {delTotal}            │   │
│   └─────────────────────────────┘   │
│ )}                                  │
│ Endelig karakter: X.XX ≈ Y          │
├─────────────────────────────────────┤
│ 👨‍🏫 Lærerens Vurdering             │
│ (Samme dynamiske struktur)          │
└─────────────────────────────────────┘
```

**Funktioner:**
- ✅ Vis AI bedømmelse per kriterium (DYNAMISK antal)
- ✅ Lærer kan justere delkarakter for ALLE kriterier (uanset antal)
- ✅ Automatisk genberegning af vægtede scorer
- ✅ Gem lærer-bedømmelse i samme dynamiske struktur
- ✅ Virker med forskellige bedømmelsesskemaer uden kodeændringer

### Phase 5: Integration i Grading System
**Filer at ændre:**
- `MathExamGrader.jsx` - Betinget rendering:
  ```jsx
  {exam.type === 'Matematik' ? (
    <StudentResult ... />
  ) : exam.type === 'Dansk' ? (
    <DanskStudentResult ... />
  ) : null}
  ```

- `useGradingLogic.js` - Tilføj dansk-specifik logik:
  ```javascript
  if (exam.type === 'Matematik') {
    return await gradeMatematikExam(...);
  } else if (exam.type === 'Dansk') {
    return await gradeDanskExam(...);
  }
  ```

---

## Kritiske Regler

### ⚠️ MÅ IKKE ÆNDRES
1. **Matematik rettelse logik** - Hold `useGradingLogic.js` matematik-funktioner uændrede
2. **Matematik resultat visning** - `StudentResult.jsx` og `OpgaveDetails.jsx` forbliver som de er
3. **Matematik datastruktur** - Eksisterende grading results format bevares
4. **Eksisterende matematik prøver** - Skal fortsætte med at virke 100% som før

### ✅ KAN ÆNDRES
1. **Upload flows** - Betinget logik baseret på exam.type
2. **Grading dispatch** - Router til korrekt grading funktion
3. **Result rendering** - Betinget komponent baseret på type
4. **Nye filer** - Tilføj dansk-specifikke komponenter og utils

---

## Datamodel Ændringer

### Exams Collection
```javascript
{
  id: "exam123",
  beskrivelse: "Dansk FP10 Efterår 2024",
  type: "Dansk", // VIGTIG!
  klasse: "9A",
  dato: Timestamp,
  
  // MATEMATIK ONLY:
  rettevejledningRef: { ... },
  omsætningstabelRef: { ... },
  
  // DANSK ONLY:
  bedoemmelseskemaRef: {
    storagePath: "exams/exam123/bedoemmelseskema.docx",
    fileName: "Dansk - bedømmelse.docx",
    contentType: "application/vnd.openxmlformats...",
    uploadedAt: Timestamp
  }
}
```

### Grading Results for Dansk (DYNAMISK STRUKTUR)
```javascript
{
  submissionId: "submission456",
  elevNavn: "Anders Andersen",
  fileName: "01_Anders_Andersen.pdf",
  
  aiGrading: {
    // DYNAMISK ARRAY - ikke hardcoded properties
    dele: [
      {
        navn: "Del B: Formelle krav",
        totalVaegt: 30,
        kriterier: [
          {
            navn: "Genre & layout",
            vaegt: 7.5,
            delKarakter: 7,
            vaegtetScore: 0.53,
            feedback: "Brevets layout overholder alle formelle krav..."
          },
          {
            navn: "Modtagerrettethed",
            vaegt: 7.5,
            delKarakter: 7,
            vaegtetScore: 0.53,
            feedback: "Sproget er tilpasset formelt brev..."
          }
          // ... flere kriterier baseret på bedømmelsesskema
        ],
        delTotal: 1.84
      },
      {
        navn: "Del C: Skriftlig fremstilling",
        totalVaegt: 70,
        kriterier: [
          {
            navn: "Indhold og opgavebesvarelse",
            vaegt: 21,
            delKarakter: 7,
            vaegtetScore: 1.47,
            feedback: "Opgaven er besvaret fyldestgørende..."
          }
          // ... flere kriterier baseret på bedømmelsesskema
        ],
        delTotal: 4.38
      }
    ],
    samletKarakter: 6.22,
    afrundetKarakter: 7,
    karakterBegrundelse: "Samlet set en god besvarelse...",
    aiProvider: "openai",
    aiModel: "gpt-4o",
    timestamp: Timestamp
  },
  
  lærerGrading: {
    // SAMME dynamiske struktur som aiGrading
    // Kun udfyldt hvis lærer har justeret
    dele: [...],
    samletKarakter: 7.0,
    afrundetKarakter: 7
  }
}
```

**Vigtige pointer:**
- ✅ `dele` er et array - ikke `delB` og `delC` som separate properties
- ✅ Antal dele og kriterier bestemmes af bedømmelsesskemaet
- ✅ Navne kommer direkte fra parsede data
- ✅ Strukturen er identisk for AI og lærer bedømmelse

---

## UI/UX Overvejelser

### Upload Flow
1. Opret prøve → Vælg type (Matematik/Dansk)
2. **Hvis Matematik:**
   - Upload rettevejledning
   - Upload omsætningstabel
3. **Hvis Dansk:**
   - Upload bedømmelseskema
   - (ingen omsætningstabel)

### Grading Flow
1. Upload elevbesvarelser (samme for begge typer)
2. Klik "Ret opgaver"
   - **Matematik:** AI analyserer per delopgave
   - **Dansk:** AI bedømmer per kriterium
3. Vis resultater
   - **Matematik:** Delopgaver med expand/collapse
   - **Dansk:** Del B/C med kriterier

### Edit Flow
1. Lærer gennemgår resultater
2. **Matematik:** Justér point per delopgave
3. **Dansk:** Justér delkarakter per kriterium
4. Gem → automatisk genberegning

---

## Testing Strategi

### Unit Tests
- `danskBedoemmelsesParser.js` - Parse forskellige fil-formater
- `useDanskGrading.js` - Beregning af vægtede scorer
- Karakterafrunding (6.22 → 7)

### Integration Tests
- Upload flow for dansk prøver
- AI bedømmelse end-to-end
- Lærer justering og gem

### Regression Tests
- **KRITISK:** Alle eksisterende matematik tests skal bestå
- Matematik prøver skal stadig virke identisk

---

## Tekniske Detaljer

### Bedømmelseskema Parser (DYNAMISK)
**Input:** Word/PDF dokument (kan variere fra eksamen til eksamen)
**Output:** Struktureret JSON med alle dele, kriterier og beskrivelser

**Parsing strategi (FLEKSIBEL):**
1. Udtræk tekst med `mammoth.js` (Word) eller `pdf-parse` (PDF)
2. **DYNAMISK parsing - INGEN hårdkodede kategorier:**
   - Identificer alle sektioner/dele (kan hedde "Del A", "Del B", "Del C", eller noget helt andet)
   - For hver del: find kriterier med procentsatser
   - Udtræk fulde beskrivelser af hvert kriterium fra bedømmelsesfilen
   - Parser skal være generic og ikke antage specifikke navne
3. Validér total vægt = 100%
4. Gem parsede data sammen med exam for senere brug

**Eksempel output (DYNAMISK struktur):**
```json
{
  "dele": [
    {
      "navn": "Del B: Formelle krav",
      "totalVaegt": 30,
      "kriterier": [
        {
          "navn": "Genre & layout",
          "vaegt": 7.5,
          "beskrivelse": "Et formelt brev skal overholde specifikke konventioner for layout: Afsender og modtager skal fremgå tydeligt, dato og sted skrives typisk øverst..."
        },
        {
          "navn": "Modtagerrettethed",
          "vaegt": 7.5,
          "beskrivelse": "Dette er et kerneelement i FP10. Censor vurderer, om du formår at tilpasse sproget: Sproget skal være sagligt, høfligt..."
        }
      ]
    },
    {
      "navn": "Del C: Skriftlig fremstilling",
      "totalVaegt": 70,
      "kriterier": [
        {
          "navn": "Indhold og opgavebesvarelse",
          "vaegt": 21,
          "beskrivelse": "Relevant indhold: Er opgaven besvaret i overensstemmelse med de krav..."
        }
      ]
    }
  ]
}
```

**Fordele ved dynamisk parsing:**
- ✅ Virker med forskellige årgange af bedømmelsesskemaer
- ✅ Virker hvis kriterierne ændres fra år til år
- ✅ Ingen hardcoded kategorinavne i koden
- ✅ Fremtidssikret - tilpasser sig automatisk til nye formater
- ✅ AI får de præcise beskrivelser fra den aktuelle eksamens bedømmelsesskema

### AI Prompt for Dansk (DYNAMISK GENERERET)

**VIGTIG:** Prompten genereres dynamisk baseret på parsede kriterier fra bedømmelsesfilen!

**Template:**
```javascript
function generateDanskPrompt(parsedBedoemmelse, elevbesvarelse) {
  let prompt = `Du er censor ved en dansk prøve.

Bedøm følgende elevbesvarelse baseret på PRÆCIS disse kriterier fra bedømmelseskemaet:

`;

  // Generer dynamisk for hver del
  parsedBedoemmelse.dele.forEach(del => {
    prompt += `## ${del.navn} (${del.totalVaegt}%)\n`;
    
    del.kriterier.forEach(krit => {
      prompt += `- ${krit.navn} (${krit.vaegt}%): ${krit.beskrivelse}\n`;
    });
    
    prompt += `\n`;
  });

  prompt += `
For hvert kriterium:
1. Giv en delkarakter på 7-trins skalaen (-3, 00, 02, 4, 7, 10, 12)
2. Giv konkret, specifik feedback baseret på kriteriebeskrivelsen
3. Jeg beregner automatisk vægtet score

Elevbesvarelse:
${elevbesvarelse}

Returner JSON i denne struktur:
{
  "dele": [
    {
      "navn": "${parsedBedoemmelse.dele[0].navn}",
      "kriterier": [
        {
          "navn": "...",
          "delKarakter": 7,
          "feedback": "..."
        }
      ]
    }
  ],
  "samletVurdering": "En kort overordnet vurdering..."
}
`;

  return prompt;
}
```

**Eksempel output (genereret fra parsede data):**
```
Du er censor ved en dansk prøve.

Bedøm følgende elevbesvarelse baseret på PRÆCIS disse kriterier fra bedømmelseskemaet:

## Del B: Formelle krav (30%)
- Genre & layout (7.5%): Et formelt brev skal overholde specifikke konventioner for layout: Afsender og modtager skal fremgå tydeligt...
- Modtagerrettethed (7.5%): Dette er et kerneelement i FP10. Censor vurderer, om du formår at tilpasse sproget...
- Struktur (6%): Rød tråd: Der skal være en logisk sammenhæng mellem indledning, midterdel og afslutning...
- Sprog & korrekthed (9%): Sproglig korrekthed: Der ses på stavning, tegnsætning og grammatik...

## Del C: Skriftlig fremstilling (70%)
- Indhold og opgavebesvarelse (21%): Relevant indhold: Er opgaven besvaret i overensstemmelse med de krav...
...
```

**Fordele ved dynamisk prompt:**
- ✅ AI får de præcise beskrivelser fra den aktuelle eksamens bedømmelsesskema
- ✅ Virker automatisk med forskellige årgange
- ✅ Ingen manuelle opdateringer nødvendige
- ✅ Konsistent med den specifikke eksamens krav

---

## Implementation Checklist

### Phase 1: Grundlæggende struktur
- [ ] Tilføj betinget logik i `CreateExamPage.jsx` for bedømmelseskema upload
- [ ] Tilføj betinget logik i `EditExamPage.jsx`
- [ ] Opdater `MathExamGrader.jsx` til at vise bedømmelseskema for dansk
- [ ] Test: Upload bedømmelseskema for dansk prøve

### Phase 2: Parsing
- [ ] Opret `src/utils/danskBedoemmelsesParser.js`
- [ ] Implementer Word parsing (mammoth.js)
- [ ] Implementer PDF parsing (pdf-parse)
- [ ] Test: Parse eksempel-bedømmelseskemaet

### Phase 3: AI Bedømmelse
- [ ] Opret `src/hooks/useDanskGrading.js`
- [ ] Implementer AI prompt generation
- [ ] Implementer væget score beregning
- [ ] Implementer karakterafrunding
- [ ] Test: Bedøm én dansk besvarelse

### Phase 4: Resultat Visning
- [ ] Opret `src/components/DanskStudentResult.jsx`
- [ ] Implementer Del B visning med kriterier
- [ ] Implementer Del C visning med kriterier
- [ ] Implementer edit mode for lærer justering
- [ ] Test: Vis dansk resultat

### Phase 5: Integration
- [ ] Opdater `MathExamGrader.jsx` med betinget rendering
- [ ] Opdater `useGradingLogic.js` med dansk dispatcher
- [ ] Opdater `StudentMatrixPage.jsx` for dansk visning
- [ ] Test: Fuld flow for dansk prøve

### Phase 6: Testing & Validering
- [ ] Test matematik prøver (regression)
- [ ] Test dansk prøver (ny funktionalitet)
- [ ] Test upload flows
- [ ] Test grading flows
- [ ] Test edit flows
- [ ] Test slet/re-upload flows

### Phase 7: Dokumentation
- [ ] Opdater README med dansk funktionalitet
- [ ] Tilføj eksempler på bedømmelsesskemaer
- [ ] Opdater bruger-dokumentation

---

## Risici og Afbødning

### Risiko 1: Breaking Changes i Matematik
**Afbødning:** 
- Tilføj comprehensive tests FØR ændringer
- Brug betinget logik (if/else) i stedet for at ændre eksisterende kode
- Code review med fokus på ikke at røre matematik-logik

### Risiko 2: Parser Fejl
**Afbødning:**
- Understøt multiple fil-formater (Word + PDF)
- Robust error handling
- Manual fallback option (indtast kriterier manuelt)

### Risiko 3: AI Bedømmelse Kvalitet
**Afbødning:**
- Detaljerede prompts med klare eksempler
- Lærer kan altid justere alle delkarakterer
- Log AI responses for kvalitetskontrol

### Risiko 4: Performance
**Afbødning:**
- Batch processing (ligesom matematik)
- Progress indicators
- Cache parsede bedømmelsesskemaer

---

## Fremtidige Udvidelser

### Potentielle forbedringer:
1. **Skabelon-bibliotek** - Forudindlæste bedømmelsesskemaer for forskellige årgange
2. **Sammenligning** - Sammenlign elevpræstationer på tværs af kriterier
3. **Statistik** - Hvilke kriterier scorer eleverne lavest/højest på?
4. **Export** - Eksporter dansk bedømmelser til Excel/PDF
5. **Historik** - Gem tidligere års bedømmelsesskemaer
6. **Multi-prøve** - Sammenlign samme elevs præstation på tværs af prøver

---

## Konklusion

Dette system udvider den eksisterende matematik-rettelsesplatform med dansk-specifikke bedømmelsesfunktioner, samtidig med at matematik-funktionaliteten forbliver 100% uændret. Ved at bruge betinget logik og separate komponenter sikrer vi ren separation mellem de to prøvetyper.

**Nøgleprincip:** Tilføj ny funktionalitet uden at ændre eksisterende funktionalitet.
