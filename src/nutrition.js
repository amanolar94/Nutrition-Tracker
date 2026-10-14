export function localDate(date = new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Athens',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=key=>parts.find(p=>p.type===key).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function totals(meals, date) {
  return meals.filter(m=>m.date===date).reduce((sum,m)=>Object.fromEntries(['calories','protein','carbs','fat'].map(key=>[key,sum[key]+(m[key]??0)])),{calories:0,protein:0,carbs:0,fat:0});
}
export function validMeal(m) {
  return Boolean(m.name?.trim()) && /^\d{4}-\d{2}-\d{2}$/.test(m.date) && Number.isFinite(m.calories) && m.calories > 0 && Number.isFinite(m.protein) && m.protein >= 0 && ['carbs','fat'].every(key=>m[key]==null||(Number.isFinite(m[key])&&m[key]>=0));
}
