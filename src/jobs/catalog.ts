export type Job = {
  id: string;
  company_id: string;
  number: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  planned_start?: string | null;
  plan_count?: number;
  open_order_count?: number;
  assigned_to_me?: boolean;
};
export type Point = {latitude: number; longitude: number};
export type JobFilter = 'all' | 'mine' | 'nearby';
export const DEMO_JOBS: Job[] = [
  {id:'demo-851', company_id:'demo', number:'851', name:'CTB', address:'624 chemin du Petit-Village Sud, Saint-Augustin-de-Desmaures', latitude:46.738,longitude:-71.493,photo_url:null,plan_count:3,open_order_count:2,assigned_to_me:true,planned_start:'Aujourd’hui'},
  {id:'demo-855', company_id:'demo', number:'855', name:'Clinique V.', address:'8910 boulevard Sainte-Anne, Château-Richer', latitude:46.953,longitude:-71.066,photo_url:null,plan_count:2,open_order_count:1,assigned_to_me:true,planned_start:'Demain'},
  {id:'demo-829', company_id:'demo', number:'829', name:'Le Bayard', address:'260 rue Bayard, Québec', latitude:46.813,longitude:-71.224,photo_url:null,plan_count:4,open_order_count:0,assigned_to_me:false},
  {id:'demo-885', company_id:'demo', number:'885', name:'Const. Chaudière', address:'496 rue des Explorateurs, Saint-Lambert-de-Lauzon', latitude:46.593,longitude:-71.221,photo_url:null,plan_count:1,open_order_count:0,assigned_to_me:false},
  {id:'demo-bureau', company_id:'demo', number:'BUREAU', name:'Bureau', address:'1653 avenue des Affaires, Québec', latitude:46.823,longitude:-71.269,photo_url:null,plan_count:1,open_order_count:0,assigned_to_me:true}
];
// Coordonnées d’illustration : NE PAS utiliser comme bornes GPS de production.
export function validGeoPoint(point:Point|null|undefined):point is Point {
  return point!=null&&Number.isFinite(point.latitude)&&
   Number.isFinite(point.longitude)&&Math.abs(point.latitude)<=90&&
   Math.abs(point.longitude)<=180;
}
export function jobHasCoordinates(job:Job):boolean {
  return validGeoPoint({latitude:job.latitude as number,longitude:job.longitude as number});
}
export function distanceKm(a:Point,b:Point):number {
  // An unavailable GPS fix must not be mistaken for a nearby job.
  if(!validGeoPoint(a)||!validGeoPoint(b))return Infinity;
  const toRad=(v:number)=>v*Math.PI/180;
  const dLat=toRad(b.latitude-a.latitude);
  const dLon=toRad(b.longitude-a.longitude);
  const x=Math.sin(dLat/2)**2+Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*Math.sin(dLon/2)**2;
  const safe=Math.min(1,Math.max(0,x));
  return 6371*2*Math.atan2(Math.sqrt(safe),Math.sqrt(1-safe));
}
export function visibleJobs(jobs:Job[], search:string, filter:JobFilter, pos:Point|null):Job[] {
  const q=search.trim().toLocaleLowerCase('fr-CA');
  const scoped=jobs.filter(j=>(filter!=='mine'||j.assigned_to_me===true)&&(!q||[j.number,j.name,j.address].join(' ').toLocaleLowerCase('fr-CA').includes(q)));
  if(filter==='nearby'){
    // Do not label every job "nearby" if the worker refused or lost GPS.
    if(!validGeoPoint(pos))return [];
    return scoped.filter(jobHasCoordinates)
     .sort((a,b)=>distanceKm(pos,{latitude:a.latitude!,longitude:a.longitude!})-
       distanceKm(pos,{latitude:b.latitude!,longitude:b.longitude!}));
  }
  return scoped;
}
