import test from 'node:test';
import assert from 'node:assert/strict';
import {loginErrorMessage,diaryErrorMessage} from './authErrors.js';
test('login failures identify required action without displaying raw server text',()=>{
 assert.match(loginErrorMessage({code:'email_not_confirmed'}),/επιβεβαιωθεί/);
 assert.match(loginErrorMessage({code:'invalid_credentials'}),/υπάρχων λογαριασμός/);
 assert.match(loginErrorMessage({code:'email_provider_disabled'}),/δεν είναι ενεργοποιημένη/);
 assert.match(loginErrorMessage({status:429}),/πολλές προσπάθειες/);
 assert.doesNotMatch(loginErrorMessage({message:'private response data'}),/private response data/);
});
test('missing database is distinguished from unsuccessful authentication',()=>{
 assert.match(diaryErrorMessage({code:'PGRST205'}),/Συνδέθηκες.*δεν έχει ρυθμιστεί/);
 assert.match(diaryErrorMessage({code:'42501'}),/δεν υπάρχει πρόσβαση/);
});
