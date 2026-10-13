export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function totals(meals, date) {
  return meals.filter(m => m.date === date).reduce((s,m) => ({calories:s.calories+m.calories, protein:s.protein+m.protein}),{calories:0,protein:0});
}
export function validMeal(m) {
  return Boolean(m.name?.trim()) && /^\d{4}-\d{2}-\d{2}$/.test(m.date) && Number.isFinite(m.calories) && m.calories > 0 && Number.isFinite(m.protein) && m.protein >= 0;
}
