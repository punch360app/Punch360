import {test} from 'node:test';
import assert from 'node:assert/strict';
import {personalUpcomingClientVisit} from '../web/live/personal-client-visit.js';
const now=Date.parse('2026-11-02T15:00:00Z');
const shifts=[
 {shift_id:'nadine-am',worker_id:'nadine',client_site_id:'st-aug',client_name:'Maison Nadine',site_name:'Accueil',
  starts_at:'2026-11-02T13:00:00Z',ends_at:'2026-11-02T17:00:00Z',
  address_line:'123 rue des Érables',city:'Saint-Augustin-de-Desmaures',region:'QC',
  access_instructions:'Entrée arrière',internal_notes:'Gestionnaire uniquement',contact_name:'Nadine',contact_phone:'418-555-0110'},
 {shift_id:'nadine-pm',worker_id:'nadine',client_site_id:'charlesbourg',client_name:'Condo Mathieu',site_name:'Porte 2',
  starts_at:'2026-11-02T18:00:00Z',ends_at:'2026-11-02T22:00:00Z',
  address_line:'456 boulevard Henri-Bourassa',city:'Charlesbourg',region:'QC'},
 {shift_id:'other-company-worker',worker_id:'other-person',client_site_id:'foreign',client_name:'Private Other',
  starts_at:'2026-11-02T14:00:00Z',ends_at:'2026-11-02T18:00:00Z',
  address_line:'Secret street',city:'Secret'},
 {shift_id:'tomorrow',worker_id:'nadine',client_site_id:'tomorrow-location',client_name:'Tomorrow Client',
  starts_at:'2026-11-03T13:00:00Z',ends_at:'2026-11-03T17:00:00Z',
  address_line:'Future street',city:'Québec'}
];
test('only own company worker visits are selected, never a manager’s colleague',()=>{
 const visit=personalUpcomingClientVisit(shifts,'nadine',now);
 assert.equal(visit.shift_id,'nadine-am');
 assert.equal(visit.ongoing,true);
 assert.equal(visit.client,'Maison Nadine');
 assert.match(visit.address,/Saint-Augustin-de-Desmaures/);
 assert.match(visit.route,/google\.com\/maps\/search/);
 assert.doesNotMatch(JSON.stringify(visit),/Private Other|Secret street|internal_notes|Gestionnaire uniquement/);
 assert.equal(personalUpcomingClientVisit(shifts,'absent-worker',now),null);
 assert.equal(personalUpcomingClientVisit(shifts,null,now),null);
});
test('next intervention is correctly chosen after previous ends, with no fake location',()=>{
 const afternoon=personalUpcomingClientVisit(shifts,'nadine',Date.parse('2026-11-02T17:30:00Z'));
 assert.equal(afternoon.shift_id,'nadine-pm');
 assert.equal(afternoon.ongoing,false);
 assert.equal(afternoon.title,'Porte 2');
 const after=personalUpcomingClientVisit(shifts,'nadine',Date.parse('2026-11-02T23:00:00Z'));
 assert.equal(after.shift_id,'tomorrow');
 assert.equal(after.ongoing,false);
 assert.equal(personalUpcomingClientVisit(shifts,'nadine',Date.parse('2026-11-07T00:00:00Z')),null);
 assert.equal(personalUpcomingClientVisit([{...shifts[0],client_site_id:null}],'nadine',now),null);
});
test('read-only selection leaves original punch and pay data unchanged',()=>{
 const input=structuredClone(shifts);
 const first=personalUpcomingClientVisit(input,'nadine',now);
 assert.ok(first);
 assert.deepEqual(input,shifts);
 assert.equal(Object.hasOwn(first,'punch_session_id'),false);
 assert.equal(Object.hasOwn(first,'latitude'),false);
 assert.equal(Object.hasOwn(first,'longitude'),false);
 assert.equal(Object.hasOwn(first,'distance_m'),false);
 assert.throws(()=>personalUpcomingClientVisit(shifts,'nadine',now,500),/Fenêtre de visites invalide/);
});
