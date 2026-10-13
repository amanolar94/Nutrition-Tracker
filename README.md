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
