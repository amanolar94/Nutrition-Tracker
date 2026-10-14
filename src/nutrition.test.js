import test from 'node:test';
import assert from 'node:assert/strict';
import { totals, validMeal, localDate } from './nutrition.js';
test('totals only include the selected day',()=>{assert.deepEqual(totals([{date:'2026-10-14',calories:350,protein:20},{date:'2026-10-14',calories:200,protein:10},{date:'2026-10-13',calories:900,protein:50}],'2026-10-14'),{calories:550,protein:30,carbs:0,fat:0});assert.deepEqual(totals([],'2026-10-14'),{calories:0,protein:0,carbs:0,fat:0});});
test('rejects invalid meal values and permits zero protein',()=>{const meal={name:'Γιαούρτι',date:'2026-10-14',calories:150,protein:0};assert.equal(validMeal(meal),true);for(const override of [{name:' '},{calories:-1},{protein:-1},{calories:NaN},{protein:Infinity}])assert.equal(validMeal({...meal,...override}),false);});
test('date uses local calendar fields',()=>assert.equal(localDate(new Date(2026,9,14,12)),'2026-10-14'));

test('Athens daily boundary follows daylight saving',()=>{assert.equal(localDate(new Date('2026-10-14T21:30:00Z')),'2026-10-15');assert.equal(localDate(new Date('2026-12-14T21:30:00Z')),'2026-12-14');});
