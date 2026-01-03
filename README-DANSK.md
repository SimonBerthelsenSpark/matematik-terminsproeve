# Matematik & Dansk Rettesystem

AI-drevet bedømmelses system til både matematik og dansk prøver med fuldt dynamisk understøttelse.

## 🎯 Funktioner

### Fælles Funktionalitet
- ✅ Opret ubegrænset antal klasser med unikke elever
- ✅ Opret ubegrænset antal prøver (Matematik eller Dansk)
- ✅ Upload individuelle elevbesvarelser per elev
- ✅ AI-rettelse af urættede besvarelser
- ✅ Lærer kan justere AI's vurdering
- ✅ Slet besvarelse fjerner også rettelser
- ✅ Re-upload erstatter gamle besvarelser

### Matematik Prøver
- 📄 Upload rettevejledning (opgaveliste med point)
- 📄 Upload omsætningstabel (point → karakter mapping)
- 🤖 AI analyserer hver delopgave individuelt
- 👨‍🏫 Lærer justerer point per delopgave
- 📊 Automatisk karakterberegning via omsætningstabel

### Dansk Prøver ⭐ NYT
- 📄 Upload bedømmelseskema (kriterier med vægte)
- 🤖 AI bedømmer per kriterium (7-trins skala)
- 👨‍🏫 Lærer justerer delkarakter per kriterium
- 📊 Automatisk beregning af vægtede scorer
- 🔄 **FULDT DYNAMISK** - tilpasser sig automatisk til bedømmelseskemaet

## 🚀 Kom I Gang

### 1. Opret Klasser og Elever
1. Gå til forsiden
2. Klik "Opret klasse"
3. Tilføj elever med elevnummer og navn

### 2. Opret Prøve

#### Matematik Prøve
1. Klik "Opret ny prøve"
2. Vælg type: **Matematik**
3. Upload rettevejledning (PDF/Word)
4. Upload omsætningstabel (PDF/Word/Excel)

#### Dansk Prøve
1. Klik "Opret ny prøve"
2. Vælg type: **Dansk**
3. Upload bedømmelseskema (PDF/Word)
   - Skal indeholde dele og kriterier med procent-vægte
   - Se eksempel nedenfor

### 3. Upload Elevbesvarelser
1. Gå til prøven
2. Klik "Matriks" for at se elevliste
3. Upload én besvarelse per elev (PDF/Word)

### 4. Ret Opgaver
1. Klik "Ret opgaver"
2. AI retter automatisk alle urættede besvarelser
3. Se resultater med AI's vurdering

### 5. Justér Som Lærer
- **Matematik**: Klik på elev → Justér point per delopgave → Gem
- **Dansk**: Klik på elev → Justér delkarakter per kriterium → Gem

## 📋 Dansk Bedømmelseskema Format

### Eksempel Struktur
```
Del B: Formelle krav

Genre & layout (7,5%)
Et formelt brev skal overholde specifikke konventioner for layout...

Modtagerrettethed (7,5%)
Dette er et kerneelement. Censor vurderer om du formår at tilpasse sproget...

Struktur (6%)
Rød tråd: Der skal være en logisk sammenhæng...

Sprog & korrekthed (9%)
Sproglig korrekthed: Der ses på stavning, tegnsætning og grammatik...


Del C: Skriftlig fremstilling

Indhold og opgavebesvarelse (21%)
Relevant indhold: Er opgaven besvaret i overensstemmelse med de krav...

Argumentation & perspektiv (17,5%)
Evnen til at sætte emnet ind i en større sammenhæng...

Struktur & sammenhæng (14%)
En tydelig rød tråd med naturlige overgange...

Sprog & stil (17,5%)
Brug af et nuanceret ordforråd og varieret sætningsbygning...
```

### Vigtige Krav til Bedømmelseskema
1. ✅ Opdel i dele (f.eks. Del B, Del C)
2. ✅ Hvert kriterium skal have procent-vægt (f.eks. 7,5%)
3. ✅ Inkluder beskrivelse af hvert kriterium
4. ✅ Total vægt skal være 100%

### Fleksibilitet
Systemet er **FULDT DYNAMISK**:
- ✅ Antal dele er IKKE fastlagt (kan være Del A, B, C, D, etc.)
- ✅ Kriterienavne er IKKE fastlagte
- ✅ Antal kriterier per del er IKKE fastlagt
- ✅ Vægtfordeling bestemmes af bedømmelseskemaet

## 📊 Hvordan Dansk Bedømmelse Virker

### 1. Parsing
Systemet læser bedømmelseskemaet og finder automatisk:
- Alle dele med deres navne
- Alle kriterier med navne og vægte
- Beskrivelser af hvert kriterium

### 2. AI Bedømmelse
For hvert kriterium:
1. AI læser kriteriebeskrivelsen
2. AI vurderer elevens besvarelse
3. AI giver delkarakter på 7-trins skala: **-3, 00, 02, 4, 7, 10, 12**
4. AI giver konkret feedback

### 3. Beregning
```
For hvert kriterium:
  Vægtet score = (Delkarakter × Vægt%) / 100

For hver del:
  Del total = Sum af vægtede scorer

Samlet karakter = Sum af alle del-totals
Afrundet = Nærmeste 7-trins karakter
```

### 4. Eksempel
```
Del B: Formelle krav (30%)
├─ Genre & layout (7,5%):
│  AI karakter: 7 → Vægtet score: 0.53
├─ Modtagerrettethed (7,5%):
│  AI karakter: 7 → Vægtet score: 0.53
├─ Struktur (6%):
│  AI karakter: 7 → Vægtet score: 0.42
└─ Sprog & korrekthed (9%):
   AI karakter: 4 → Vægtet score: 0.36
   
Del B Total: 1.84

Del C: Skriftlig fremstilling (70%)
[... kriterier ...]
Del C Total: 4.38

Samlet karakter: 1.84 + 4.38 = 6.22
Afrundet til 7-trins: 7
```

### 5. Lærer Justering
Læreren kan ændre delkarakter for ethvert kriterium:
```
Genre & layout: 7 → [[Lærer ændrer til]] → 10
Vægtet score opdateres automatisk: 0.53 → 0.75
Del total genberegnes automatisk
Samlet karakter genberegnes automatisk
```

## 🔧 Teknisk Arkitektur

### Filstruktur
```
src/
├── components/
│   ├── StudentResult.jsx          (Matematik)
│   ├── DanskStudentResult.jsx     (Dansk) ⭐ NY
│   └── MathExamGrader.jsx         (Fælles - betinget rendering)
├── hooks/
│   ├── useGradingLogic.js         (Matematik)
│   ├── useDanskGrading.js         (Dansk) ⭐ NY
│   └── useFileUpload.js           (Fælles - opdateret)
├── utils/
│   └── danskBedoemmelsesParser.js (Dansk parser) ⭐ NY
├── services/
│   ├── storageService.js          (Opdateret)
│   └── firestoreService.js        (Uændret)
└── pages/
    ├── CreateExamPage.jsx         (Opdateret - betinget UI)
    └── StudentMatrixPage.jsx      (Uændret)
```

### Datamodel

#### Exams Collection
```javascript
{
  id: "exam123",
  beskrivelse: "FP10 Dansk Efterår 2024",
  type: "Dansk", // eller "Matematik"
  klasse: "9A",
  dato: Timestamp,
  
  // Matematik only:
  rettevejledningRef: {...},
  omsætningstabelRef: {...},
  
  // Dansk only:
  bedoemmelseskemaRef: {...},
  parsedBedoemmelse: {
    dele: [
      {
        navn: "Del B: Formelle krav",
        totalVaegt: 30,
        kriterier: [
          {
            navn: "Genre & layout",
            vaegt: 7.5,
            beskrivelse: "..."
          }
        ]
      }
    ]
  }
}
```

#### Grading Results

**Matematik:**
```javascript
{
  submissionId: "123",
  elevNavn: "Anders",
  opgaver: [...],
  totalPoint: 65,
  karakter: 10,
  lærerGrading: {
    opgaver: [...],
    totalPoint: 67,
    karakter: 10
  }
}
```

**Dansk:**
```javascript
{
  submissionId: "123",
  elevNavn: "Anders",
  dele: [
    {
      navn: "Del B: Formelle krav",
      kriterier: [
        {
          navn: "Genre & layout",
          vaegt: 7.5,
          delKarakter: 7,
          vaegtetScore: 0.53,
          feedback: "..."
        }
      ],
      delTotal: 1.84
    }
  ],
  samletKarakter: 6.22,
  afrundetKarakter: 7,
  lærerGrading: {
    // Samme struktur som AI grading
  }
}
```

## 🔒 Kritiske Regler

### ⚠️ Matematik Funktionalitet
- **UÆNDRET** - Alt matematik kode virker præcis som før
- Ingen breaking changes
- Eksisterende prøver virker 100%

### ✅ Tilføjet Funktionalitet
- Betinget logik baseret på `exam.type`
- Separate komponenter for dansk
- Fælles infrastruktur (storage, submissions, etc.)

## 💡 Best Practices

### Opret Bedømmelseskema
1. Brug Word format (.docx) - nemmere at parse end PDF
2. Klar struktur med "Del X:" overskrifter
3. Hvert kriterium på egen linje med procent
4. Inkluder detaljerede beskrivelser

### Elevbesvarelser
1. Ensartet navngivning anbefales
2. PDF eller Word format
3. Enkelte filer (ikke ZIP)

### AI Rettelse
1. First-time? Start med 1-2 elever for at teste
2. Tjek AI's vurdering før masseret