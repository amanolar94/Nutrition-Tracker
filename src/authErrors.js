export function loginErrorMessage(error) {
  if (error?.code === 'email_not_confirmed') return 'Το email δεν έχει επιβεβαιωθεί. Έλεγξε το email σου ή επικοινώνησε με τον διαχειριστή.';
  if (error?.code === 'invalid_credentials') return 'Το email ή ο κωδικός δεν είναι σωστός. Χρειάζεται υπάρχων λογαριασμός.';
  if (error?.code === 'email_provider_disabled') return 'Η σύνδεση με email δεν είναι ενεργοποιημένη. Επικοινώνησε με τον διαχειριστή.';
  if (error?.status === 429) return 'Έγιναν πολλές προσπάθειες σύνδεσης. Περίμενε λίγο και δοκίμασε ξανά.';
  return 'Η σύνδεση απέτυχε. Δοκίμασε ξανά ή επικοινώνησε με τον διαχειριστή.';
}
export function diaryErrorMessage(error) {
  if (['PGRST205', '42P01'].includes(error?.code)) return 'Συνδέθηκες, αλλά η βάση γευμάτων δεν έχει ρυθμιστεί. Επικοινώνησε με τον διαχειριστή.';
  if (error?.code === '42501') return 'Συνδέθηκες, αλλά δεν υπάρχει πρόσβαση στα δεδομένα σου. Επικοινώνησε με τον διαχειριστή.';
  return 'Συνδέθηκες, αλλά δεν φορτώθηκαν τα δεδομένα σου. Έλεγξε τη σύνδεση και δοκίμασε ξανά.';
}
