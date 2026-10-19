# Nutrition Tracker

Εφαρμογή React στα ελληνικά για γεύματα, θερμίδες και πρωτεΐνη, με Supabase Auth και Postgres.

## Ρύθμιση Supabase

1. Δημιούργησε project στο Supabase.
2. Εκτέλεσε το `supabase/schema.sql` στον SQL Editor μία φορά. Δημιουργεί πίνακες και Row Level Security: κάθε χρήστης βλέπει και αλλάζει μόνο τις δικές του εγγραφές.
3. Στο Supabase Authentication → Sign In / Providers → Email ενεργοποίησε Email/password και απενεργοποίησε το Allow new users to sign up. Η εφαρμογή επιτρέπει μόνο σύνδεση υπαρχόντων χρηστών. Δημιούργησε τους λογαριασμούς από Authentication → Users → Add user → Create new user, ορίζοντας email/κωδικό και επιβεβαίωση email όπου χρειάζεται.
4. Στο Authentication → URL Configuration όρισε το Site URL και επιτρεπόμενο Redirect URL `https://nutrition-tracker-gamma-flax.vercel.app/`. Για ανάπτυξη πρόσθεσε `http://localhost:5173/`.
5. Αντέγραψε το `.env.example` σε `.env.local`. Συμπλήρωσε το Project URL και το **publishable key** από τις ρυθμίσεις του project. Ποτέ service_role ή secret key στο frontend. Οι μεταβλητές VITE_* είναι δημόσιες και ενσωματώνονται στο build. Στο Vercel όρισέ τες στις Environment Variables.
6. Επανεκκίνησε τον dev server ή κάνε νέο build μετά από αλλαγή μεταβλητών. Δεν απαιτούνται Google OAuth credentials.

```sh
npm ci --cache /tmp/nutrition-npm-cache
npm run dev
```

Απαιτείται Node.js 22.12+ ή 24.

## Έλεγχοι

```sh
npm test
npm run build
```

Για τον τελικό έλεγχο με πραγματικό project: συνδέσου με υπάρχοντα λογαριασμό email/κωδικού, πρόσθεσε γεύμα, άλλαξε στόχους και επαναφόρτωσε. Έλεγξε τα ίδια δεδομένα από δεύτερο browser. Με δεύτερο λογαριασμό επιβεβαίωσε ότι δεν φαίνονται τα γεύματα του πρώτου και ότι οι απευθείας αιτήσεις για ξένο user_id απορρίπτονται από RLS.

## Αποθήκευση

Τα γεύματα και οι στόχοι αποθηκεύονται στη βάση Supabase ανά χρήστη. Η συνεδρία σύνδεσης διατηρείται στον browser από το Supabase SDK. Η σύνδεση γίνεται με email/κωδικό μέσω Supabase Auth. Ο κωδικός αποστέλλεται στο Supabase για έλεγχο και δεν αποθηκεύεται στους πίνακες γευμάτων ή στο localStorage της εφαρμογής.

Οι παλιές καταγραφές της πρώτης έκδοσης παραμένουν στο localStorage με κλειδί `nutrition-tracker-v1`. Δεν μεταφέρονται αυτόματα σε λογαριασμό και δεν διαγράφονται από αυτή την έκδοση.

Χωρίς ρυθμισμένο Supabase εμφανίζεται μήνυμα ότι η σύνδεση δεν έχει ενεργοποιηθεί. Οι προεπιλεγμένοι στόχοι είναι ενδεικτικοί και τα διατροφικά στοιχεία εισάγονται χειροκίνητα.

## Καταγραφή στο ChatGPT

Η εφαρμογή χρησιμοποιεί την υπάρχουσα σύνδεση Nutrition Tracker μέσω MCP/OAuth.
Το παλιό GPT Action με προσωπικά κλειδιά έχει αποσυρθεί: το `/api/meals`
επιστρέφει HTTP 410 και το παλιό OpenAPI αρχείο δεν προσφέρει λειτουργίες εγγραφής.
Εφάρμοσε τελευταία τη migration `supabase/migrations/20261019_retire_personal_keys.sql`
για να κλείσουν και τα απευθείας legacy RPCs στο Supabase και η δημιουργία κλειδιών.
Τα υπάρχοντα γεύματα και τα αποθηκευμένα hashes διατηρούνται. Οι παλιές ρυθμίσεις
κλειδιών έχουν αφαιρεθεί από το site. Η πρόσβαση εφαρμογών μέσω OAuth ανακαλείται
από Ρυθμίσεις → Λογαριασμός → Συνδεδεμένες εφαρμογές.

## Remote MCP στο ίδιο site

Το `/mcp` χρησιμοποιεί official MCP SDK / stateless Streamable HTTP και Supabase OAuth 2.1. Περιλαμβάνει γεύματα με όλα τα macros, τροφοδοσία προπόνησης, βάρος και στόχους ανάπαυσης/προπόνησης. Οι εγγραφές MCP απαιτούν ρητή επιβεβαίωση στο ChatGPT χωρίς δεύτερη έγκριση στο dashboard.

Ακριβή βήματα migration/OAuth/Vercel/σύνδεσης του **υπάρχοντος** plugin και live acceptance checks: [docs/MCP_SETUP.md](docs/MCP_SETUP.md). Input schemas: [docs/mcp-tools.json](docs/mcp-tools.json). Ενημερωμένες οδηγίες του υπάρχοντος plugin: [docs/plugin-instructions.md](docs/plugin-instructions.md).

Εφάρμοσε τη νέα migration για να ενεργοποιηθούν τα νέα macros/βάρη/MCP. Μέχρι τότε το dashboard χρησιμοποιεί τα παλιά queries και διατηρεί login, γεύματα και στόχους θερμίδων/πρωτεΐνης. Οι τοπικοί έλεγχοι δεν επιβεβαιώνουν πραγματική σύνδεση ChatGPT/Supabase OAuth.

Για αναβάθμιση υπάρχοντος MCP χωρίς drafts: [docs/DIRECT_WRITES_UPGRADE.md](docs/DIRECT_WRITES_UPGRADE.md).

## Προβολή σε κινητό

Το dashboard οργανώνεται σε Ημέρα, Εβδομάδα, Πρόοδο και Ρυθμίσεις. Στο κινητό η πλοήγηση βρίσκεται χαμηλά στην οθόνη. Τα γεύματα εμφανίζονται ανά κατηγορία, οι εβδομαδιαίες μπάρες ανοίγουν την αντίστοιχη ημέρα και η χειροκίνητη καταχώριση ανοίγει με το κουμπί +. Σχεδιαστικές επιλογές και έλεγχοι: [docs/UX_NOTES.md](docs/UX_NOTES.md).

## Θερμίδες προπόνησης και ισοζύγιο

Προσθήκη, διόρθωση και διαγραφή προπονήσεων από ChatGPT/MCP ή το ημερολόγιο, με ενεργές θερμίδες άσκησης. Ημέρα και εβδομάδα εμφανίζουν εκτιμώμενο έλλειμμα/πλεόνασμα σε σχέση με τη συντήρηση χωρίς προπόνηση, ανεξάρτητα από τους στόχους φαγητού. Ημέρες χωρίς γεύματα δεν δημιουργούν τεχνητό έλλειμμα. Απαιτείται η additive migration `20261019_workout_energy.sql` και αποθήκευση συντήρησης από τις Ρυθμίσεις ή το MCP. [Ενεργοποίηση, εργαλεία και υπολογισμοί](docs/WORKOUT_ENERGY.md).

## Supabase Security Advisor

Η migration `20261019_retire_personal_keys.sql` αφαιρεί την πρόσβαση στις παλιές REST functions και τη δημιουργία προσωπικών κλειδιών. Το `write_nutrition` παραμένει διαθέσιμο μόνο σε συνδεδεμένους χρήστες, με έλεγχο ιδιοκτησίας και idempotency. Η αντίστοιχη προειδοποίηση SECURITY DEFINER είναι αναμενόμενη. Η προστασία διαρρεύσαντων κωδικών ενεργοποιείται ξεχωριστά στο Supabase Auth. [Ερμηνεία ευρημάτων και βήματα](docs/SECURITY_ADVISOR.md).
