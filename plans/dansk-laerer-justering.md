# Dansk Prøver - Lærer Justering Funktionalitet

## Oversigt

**JA** - Læreren kan justere dansk bedømmelser præcis som i matematik, bare med kriterier i stedet for opgaver!

## Funktionalitet

### 1. Lærer Kan Ændre Delkarakterer

For **HVERT kriterium** i **HVER del** kan læreren:
- Se AI's forslag til delkarakter (7-trins skala: -3, 00, 02, 4, 7, 10, 12)
- Ændre karakteren til en anden værdi
- Se den automatisk genberegnede vægtede score
- Tilføje eller justere feedback (valgfrit)

### 2. Automatisk Genberegning

Når læreren ændrer en delkarakter sker følgende automatisk:

```javascript
// Eksempel: Lærer ændrer "Genre & layout" fra 7 til 10

// 1. Vægtet score genberegnes
AI karakter: 7 × 7.5% = 0.525
Lærer karakter: 10 × 7.5% = 0.75  ← AUTOMATISK

// 2. Del-total genberegnes
Del B total (AI): 1.84
Del B total (Lærer): 2.01  ← AUTOMATISK (sum af alle kriterier)

// 3. Samlet karakter genberegnes
Samlet (AI): 6.22 ≈ 7
Samlet (Lærer): 7.45 ≈ 7  ← AUTOMATISK

// 4. Afrunding til 7-trins skala
7.45 → nærmeste karakter = 7
```

### 3. UI Eksempel

```
┌─────────────────────────────────────────────────────┐
│ Elev: Anders Andersen                               │
├─────────────────────────────────────────────────────┤
│ 🤖 AI's Vurdering                                   │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Del B: Formelle krav (30%)                      │ │
│ │                                                 │ │
│ │ Genre & layout (7.5%)                           │ │
│ │   Karakter: 7                                   │ │
│ │   Vægtet score: 0.53                            │ │
│ │   Feedback: "Brevets layout overholder..."      │ │
│ │                                                 │ │
│ │ Modtagerrettethed (7.5%)                        │ │
│ │   Karakter: 7                                   │ │
│ │   Vægtet score: 0.53                            │ │
│ │   Feedback: "Sproget er tilpasset..."           │ │
│ │                                                 │ │
│ │ Del B Total: 1.84                               │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Samlet AI Karakter: 6.22 ≈ 7                       │
├─────────────────────────────────────────────────────┤
│ 👨‍🏫 Lærerens Vurdering                            │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Del B: Formelle krav (30%)                      │ │
│ │                                                 │ │
│ │ Genre & layout (7.5%)                           │ │
│ │   Karakter: [10 ▼]  ← DROPDOWN MED 7-TRINS     │ │
│ │   Vægtet score: 0.75  ← AUTO-BEREGNET          │ │
│ │   Feedback: "Brevets layout overholder..."      │ │
│ │            [✏️ Rediger feedback]                 │ │
│ │                                                 │ │
│ │ Modtagerrettethed (7.5%)                        │ │
│ │   Karakter: [4 ▼]  ← DROPDOWN                  │ │
│ │   Vægtet score: 0.30  ← AUTO-BEREGNET          │ │
│ │   Feedback: [Lærer kan justere...]             │ │
│ │                                                 │ │
│ │ Del B Total: 2.01  ← AUTO-BEREGNET             │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Samlet Lærer Karakter: 7.45 ≈ 7  ← AUTO-BEREGNET  │
│                                                     │
│ [💾 Gem Ændringer]  [❌ Annuller]                  │
└─────────────────────────────────────────────────────┘
```

### 4. Workflow

**Trin 1: Se AI's bedømmelse**
- Lærer åbner elevens resultat
- Ser AI's bedømmelse for alle kriterier
- Kan læse AI's feedback for hvert kriterium

**Trin 2: Start redigering**
- Klik på "Rediger" knap (eller klik direkte på et kriterium)
- Alle delkarakterer bliver editable dropdowns/inputs

**Trin 3: Justér karakterer**
- Vælg ny delkarakter fra dropdown (7-trins skala)
- Vægtede scorer opdateres live
- Del-totaler opdateres live
- Samlet karakter opdateres live

**Trin 4: Gem**
- Klik "Gem Ændringer"
- Lærer-bedømmelse gemmes til Firestore
- Både AI og lærer bedømmelse er nu synlige

### 5. Datastruktur (Gemt i Firestore)

```javascript
// exams/{examId}/submissions/{submissionId}/gradingResults/{resultId}
{
  submissionId: "submission123",
  elevNavn: "Anders Andersen",
  
  // AI's bedømmelse (aldrig ændret)
  aiGrading: {
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
            feedback: "Brevets layout..."
          },
          {
            navn: "Modtagerrettethed",
            vaegt: 7.5,
            delKarakter: 7,
            vaegtetScore: 0.53,
            feedback: "Sproget er..."
          }
        ],
        delTotal: 1.84
      }
    ],
    samletKarakter: 6.22,
    afrundetKarakter: 7
  },
  
  // Lærerens bedømmelse (kun hvis lærer har justeret)
  lærerGrading: {
    dele: [
      {
        navn: "Del B: Formelle krav",
        totalVaegt: 30,
        kriterier: [
          {
            navn: "Genre & layout",
            vaegt: 7.5,
            delKarakter: 10,  // ← LÆRER ÆNDREDE FRA 7 TIL 10
            vaegtetScore: 0.75,
            feedback: "Brevets layout..." // Kan være justeret
          },
          {
            navn: "Modtagerrettethed",
            vaegt: 7.5,
            delKarakter: 4,  // ← LÆRER ÆNDREDE FRA 7 TIL 4
            vaegtetScore: 0.30,
            feedback: "Jeg er ikke enig med AI - sproget..." // Justeret
          }
        ],
        delTotal: 2.01  // ← AUTO-BEREGNET
      }
    ],
    samletKarakter: 7.45,  // ← AUTO-BEREGNET
    afrundetKarakter: 7,   // ← AUTO-AFRUNDET
    timestamp: Timestamp
  }
}
```

### 6. Sammenligning Med Matematik

| Aspekt | Matematik | Dansk |
|--------|-----------|-------|
| **Hvad justeres** | Point per delopgave (0-75) | Delkarakter per kriterium (7-trins) |
| **Antal elementer** | Antal delopgaver | Antal kriterier (dynamisk) |
| **Beregning** | Sum point → lookup i omsætningstabel | Vægtede scorer → sum = karakter |
| **UI** | Input fields for point | Dropdown for karakterer |
| **Live opdatering** | Ja - total point opdateres | Ja - vægtede scorer og karakter |
| **Gem funktion** | Ja | Ja |

### 7. Implementationsdetaljer

**Component State:**
```jsx
function DanskStudentResult({ result, parsedBedoemmelse }) {
  const [editMode, setEditMode] = useState(false);
  const [tempKarakterer, setTempKarakterer] = useState({});
  const [tempFeedback, setTempFeedback] = useState({});
  
  // Når lærer ændrer en karakter
  const handleKarakterChange = (delIdx, kritIdx, newKarakter) => {
    setTempKarakterer({
      ...tempKarakterer,
      [`${delIdx}-${kritIdx}`]: parseInt(newKarakter)
    });
    
    // Genberegn live preview
    recalculateLive();
  };
  
  // Live genberegning
  const recalculateLive = () => {
    let samletKarakter = 0;
    
    parsedBedoemmelse.dele.forEach((del, delIdx) => {
      let delTotal = 0;
      
      del.kriterier.forEach((krit, kritIdx) => {
        const key = `${delIdx}-${kritIdx}`;
        const delKarakter = tempKarakterer[key] ?? 
                           result.lærerGrading?.dele[delIdx]?.kriterier[kritIdx]?.delKarakter ??
                           result.aiGrading.dele[delIdx].kriterier[kritIdx].delKarakter;
        
        const vaegtetScore = (delKarakter * krit.vaegt) / 100;
        delTotal += vaegtetScore;
      });
      
      samletKarakter += delTotal;
    });
    
    const afrundetKarakter = roundTo7trins(samletKarakter);
    
    return { samletKarakter, afrundetKarakter };
  };
  
  // Gem lærer bedømmelse
  const handleSave = async () => {
    const lærerGrading = buildLærerGrading();
    await saveGradingResult(examId, submissionId, {
      ...result,
      lærerGrading
    });
    setEditMode(false);
  };
}
```

**7-trins afrunding:**
```javascript
function roundTo7trins(karakter) {
  const trins = [-3, 0, 2, 4, 7, 10, 12];
  
  // Find nærmeste trin
  let nearest = trins[0];
  let minDiff = Math.abs(karakter - nearest);
  
  for (const trin of trins) {
    const diff = Math.abs(karakter - trin);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = trin;
    }
  }
  
  return nearest;
}
```

### 8. Visning i StudentMatrixPage

I tabel-oversigten vises både AI og lærer karakterer:

```
┌────────────┬──────────────┬────────────┬─────────────────┐
│ Elevnr.    │ Navn         │ AI Karakter│ Lærer Karakter  │
├────────────┼──────────────┼────────────┼─────────────────┤
│ 01         │ Anders A.    │ 7          │ 7               │
│ 02         │ Bente B.     │ 4          │ 7 (justeret)    │
│ 03         │ Carl C.      │ 10         │ -               │
└────────────┴──────────────┴────────────┴─────────────────┘
```

## Konklusion

✅ **JA** - Lærer kan fuldt ud justere dansk bedømmelser
✅ Præcis samme koncept som matematik, bare med:
   - Kriterier i stedet for opgaver
   - Delkarakterer i stedet for point
   - Vægtede scorer i stedet for direkte sum

**Nøglepointe:** Systemet er symmetrisk - både matematik og dansk har fuld lærer-justerings funktionalitet!
