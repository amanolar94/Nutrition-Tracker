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

## Καταγραφή από δικό σου GPT στο ChatGPT

1. Εκτέλεσε μία φορά τη migration `supabase/migrations/20261014_chatgpt_actions.sql` στον SQL Editor, αφού υπάρχει το αρχικό schema. Δεν διαγράφει υπάρχοντα γεύματα. Χρησιμοποιεί το pgcrypto στο schema `extensions` (η προεπιλογή Supabase).
2. Κάνε deploy στο Vercel. Το `/api/meals` είναι Vercel serverless function. Χρησιμοποιεί τα υπάρχοντα `VITE_SUPABASE_URL` και `VITE_SUPABASE_PUBLISHABLE_KEY` από το server περιβάλλον ή εναλλακτικά `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`. Δεν απαιτεί service_role ή OpenAI API key. Το `npm run dev` εξυπηρετεί μόνο το frontend· για τοπικό έλεγχο του endpoint χρησιμοποίησε το Vercel development runtime.
3. Συνδέσου στο site, άνοιξε «Σύνδεση με το δικό σου GPT» και δημιούργησε προσωπικό κλειδί. Αντέγραψέ το αμέσως. Αποθηκεύεται μόνο το SHA-256 hash του στη βάση. Το κλειδί λήγει σε 90 ημέρες και ανακαλείται από το ίδιο panel.
4. Στο ChatGPT δημιούργησε/επεξεργάσου δικό σου GPT (απαιτείται λογαριασμός με δυνατότητα δημιουργίας GPTs). Στο Configure → Actions εισήγαγε το schema από `https://nutrition-tracker-gamma-flax.vercel.app/chatgpt/openapi.json`.
5. Authentication → API Key → Bearer: βάλε το προσωπικό κλειδί. Ποτέ στο prompt, σε συνομιλία, GitHub ή frontend env. Για αυτή την έκδοση κράτα το GPT ιδιωτικό/Only me: όποιος χρησιμοποιεί το ίδιο Action key γράφει στον ίδιο λογαριασμό. Για δημόσιο GPT πολλών χρηστών χρειάζεται OAuth ανά χρήστη, που δεν υλοποιείται εδώ.
6. Αν ζητηθεί Privacy Policy URL, βάλε `https://nutrition-tracker-gamma-flax.vercel.app/privacy.html`. Αντέγραψε το `public/chatgpt/instructions.txt` στις Instructions του GPT. Το GPT ζητά ποσότητες και επιβεβαίωση, εξηγεί ότι οι θερμίδες/πρωτεΐνη είναι εκτιμήσεις, και αποθηκεύει μόνο αφού συμφωνήσεις. Δεν έχει πρόσβαση ανάγνωσης ή διαγραφής γευμάτων.
7. Δοκίμασε πραγματική καταχώριση και άνοιξε το site. Το ημερολόγιο ανανεώνεται όταν επιστρέφεις στην καρτέλα· υπάρχει και «Ανανέωση». Επίλεξε την ημερομηνία που κατέγραψες.

### Έλεγχος ασφάλειας και επαναλήψεων

Η βάση επιλέγει τον ιδιοκτήτη από το έγκυρο προσωπικό κλειδί, όχι από user_id του GPT. Το endpoint δεν καταγράφει tokens ή request bodies. Κάθε γεύμα έχει request_id ώστε επανάληψη της ίδιας αίτησης να μην δημιουργεί διπλό γεύμα. Το κλειδί δίνει δικαίωμα προσθήκης γευμάτων, γι' αυτό κράτησέ το ιδιωτικό.

Πριν θεωρηθεί ενεργή η σύνδεση: έλεγξε πραγματική καταχώριση, επανάληψη με ίδιο request_id, δύο διαφορετικά accounts/keys, ληγμένο και ανακλημένο κλειδί. Τα automated API tests χρησιμοποιούν mock database και δεν αντικαθιστούν αυτούς τους ελέγχους στο Supabase.

## Remote MCP στο ίδιο site

Το `/mcp` χρησιμοποιεί official MCP SDK / stateless Streamable HTTP και Supabase OAuth 2.1. Περιλαμβάνει γεύματα με όλα τα macros, τροφοδοσία προπόνησης, βάρος και στόχους ανάπαυσης/προπόνησης. Οι εγγραφές MCP απαιτούν ρητή επιβεβαίωση στο ChatGPT χωρίς δεύτερη έγκριση στο dashboard.

Ακριβή βήματα migration/OAuth/Vercel/σύνδεσης του **υπάρχοντος** plugin και live acceptance checks: [docs/MCP_SETUP.md](docs/MCP_SETUP.md). Input schemas: [docs/mcp-tools.json](docs/mcp-tools.json). Ενημερωμένες οδηγίες του υπάρχοντος plugin: [docs/plugin-instructions.md](docs/plugin-instructions.md).

Εφάρμοσε τη νέα migration για να ενεργοποιηθούν τα νέα macros/βάρη/MCP. Μέχρι τότε το dashboard χρησιμοποιεί τα παλιά queries και διατηρεί login, γεύματα και στόχους θερμίδων/πρωτεΐνης. Οι τοπικοί έλεγχοι δεν επιβεβαιώνουν πραγματική σύνδεση ChatGPT/Supabase OAuth.

Για αναβάθμιση υπάρχοντος MCP χωρίς drafts: [docs/DIRECT_WRITES_UPGRADE.md](docs/DIRECT_WRITES_UPGRADE.md).

## Προβολή σε κινητό

Το dashboard οργανώνεται σε Ημέρα, Εβδομάδα, Πρόοδο και Ρυθμίσεις. Στο κινητό η πλοήγηση βρίσκεται χαμηλά στην οθόνη. Τα γεύματα εμφανίζονται ανά κατηγορία, οι εβδομαδιαίες μπάρες ανοίγουν την αντίστοιχη ημέρα και η χειροκίνητη καταχώριση ανοίγει με το κουμπί +. Σχεδιαστικές επιλογές και έλεγχοι: [docs/UX_NOTES.md](docs/UX_NOTES.md).

## Θερμίδες προπόνησης και ισοζύγιο

Προσθήκη, διόρθωση και διαγραφή προπονήσεων από ChatGPT/MCP ή το ημερολόγιο, με ενεργές θερμίδες άσκησης. Ημέρα και εβδομάδα εμφανίζουν εκτιμώμενο έλλειμμα/πλεόνασμα σε σχέση με τη συντήρηση χωρίς προπόνηση, ανεξάρτητα από τους στόχους φαγητού. Ημέρες χωρίς γεύματα δεν δημιουργούν τεχνητό έλλειμμα. Απαιτείται η additive migration `20261019_workout_energy.sql` και αποθήκευση συντήρησης από τις Ρυθμίσεις ή το MCP. [Ενεργοποίηση, εργαλεία και υπολογισμοί](docs/WORKOUT_ENERGY.md).
