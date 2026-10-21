# Opsætning: login og låst database

Gør trinene i rækkefølge. Indtil trin 5 er gjort, er databasen stadig åben.

1. **Slå login med e-mail til** – Firebase-konsollen → projekt *retopgave* → Authentication → Kom i gang → Sign-in method → **Email/Password** → Aktivér → Gem.
   Under Authentication → Settings → **Authorized domains**: tilføj `lovely-lolly-f39ae9.netlify.app` (og jeres eget domæne, hvis I har et).
2. **Opret din konto** i appen med en af administrator-e-mailene (`s.berhelsen@gmail.com` eller `simonberthelsen@hotmail.com`), og bekræft e-mailen via linket.
3. **Overtag de eksisterende data** – Indstillinger → "Data fra før login" → **Overtag**. (Ellers kan ingen se dem, når databasen låses.)
4. **Godkend lærere** – Indstillinger → Lærere → skriv lærerens e-mail → Godkend. Læreren opretter selv sin konto med samme e-mail.
5. **Lås databasen** – kopiér `firestore.rules` til Firestore Database → Regler → **Udgiv**, og `storage.rules` til Storage → Regler → **Udgiv**. Sig ja, når Firebase spørger, om Storage-reglerne må læse Firestore.
   (Eller med Firebase CLI: `firebase deploy --only firestore:rules,storage`.)
6. **EU-databehandling hos OpenAI (anbefalet)** – platform.openai.com → opret et nyt projekt med region **Europe** → opret en API-nøgle i projektet. I Netlify → Site configuration → Environment variables:
   - `OPENAI_API_KEY` = den nye nøgle
   - `OPENAI_BASE_URL` = `https://eu.api.openai.com/v1`
   Deploy igen (Deploys → Trigger deploy).
7. **Gør GitHub-repoet privat** – GitHub → Settings → General → Danger Zone → Change visibility → Private.
   Elevfilerne er fjernet fra historikken, men GitHub kan stadig have gamle kopier i lukkede pull requests. Vil I være helt sikre, kan GitHub Support fjerne dem ("remove cached views / sensitive data").

## Administratorer
De faste administratorer står i `src/config/admins.js`, `firestore.rules`, `storage.rules` og (valgfrit) Netlify-variablen `ADMIN_EMAILS`. Ret alle steder, hvis listen ændres. Øvrige administratorer kan udpeges under Indstillinger → Lærere.
