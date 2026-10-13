# Nutrition Tracker

Εφαρμογή React στα ελληνικά για γεύματα, θερμίδες και πρωτεΐνη, με Supabase Auth και Postgres.

## Ρύθμιση Supabase

1. Δημιούργησε project στο Supabase.
2. Εκτέλεσε το `supabase/schema.sql` στον SQL Editor μία φορά. Δημιουργεί πίνακες και Row Level Security: κάθε χρήστης βλέπει και αλλάζει μόνο τις δικές του εγγραφές.
3. Στο Google Cloud Console ρύθμισε OAuth consent screen και δημιούργησε OAuth Client ID τύπου Web application. Στα Authorized redirect URIs βάλε το callback URL που εμφανίζει το Supabase στον Google provider (συνήθως `https://<project-ref>.supabase.co/auth/v1/callback`). Αν η εφαρμογή Google είναι σε testing, πρόσθεσε τους λογαριασμούς δοκιμής ως test users.
4. Στο Supabase Authentication → Providers → Google ενεργοποίησε τον provider και συμπλήρωσε το Google Client ID και Client Secret. Το Client Secret παραμένει μόνο στο Supabase, ποτέ στον κώδικα ή σε VITE_* μεταβλητές.
5. Στο Supabase Authentication → URL Configuration όρισε το Site URL και βάλε στα επιτρεπόμενα Redirect URLs την ακριβή διεύθυνση επιστροφής του site, π.χ. `https://your-site.example/`, και για ανάπτυξη `http://localhost:5173/`. Η εφαρμογή επιστρέφει στη ρίζα του τρέχοντος origin.
6. Αντέγραψε το `.env.example` σε `.env.local`. Συμπλήρωσε το Project URL και το **publishable key** από τις ρυθμίσεις του project. Ποτέ service_role ή secret key στο frontend. Οι μεταβλητές VITE_* είναι δημόσιες και ενσωματώνονται στο build.
7. Επανεκκίνησε τον dev server ή κάνε νέο build μετά από αλλαγή μεταβλητών.

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

Για τον τελικό έλεγχο με πραγματικό project: πάτησε «Συνέχεια με Google», ολοκλήρωσε τη σύνδεση, πρόσθεσε γεύμα, άλλαξε στόχους και επαναφόρτωσε. Έλεγξε τα ίδια δεδομένα από δεύτερο browser. Με δεύτερο λογαριασμό επιβεβαίωσε ότι δεν φαίνονται τα γεύματα του πρώτου και ότι οι απευθείας αιτήσεις για ξένο user_id απορρίπτονται από RLS.

## Αποθήκευση

Τα γεύματα και οι στόχοι αποθηκεύονται στη βάση Supabase ανά χρήστη. Η συνεδρία σύνδεσης διατηρείται στον browser από το Supabase SDK. Η σύνδεση γίνεται μέσω Google OAuth και Supabase Auth. Η εφαρμογή δεν λαμβάνει ούτε αποθηκεύει τον κωδικό Google.

Οι παλιές καταγραφές της πρώτης έκδοσης παραμένουν στο localStorage με κλειδί `nutrition-tracker-v1`. Δεν μεταφέρονται αυτόματα σε λογαριασμό και δεν διαγράφονται από αυτή την έκδοση.

Χωρίς ρυθμισμένο Supabase εμφανίζεται μήνυμα ότι η σύνδεση δεν έχει ενεργοποιηθεί. Οι προεπιλεγμένοι στόχοι είναι ενδεικτικοί και τα διατροφικά στοιχεία εισάγονται χειροκίνητα.
