// MISSION-004/009 partial: upcoming days are explicit, read-only and bounded.
// Dates are company app's existing local-day convention; no GPS or punch inference.
function localDay(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
export function nextMissionDay(now=new Date()){
 const copy=new Date(now.getTime());copy.setDate(copy.getDate()+1);return localDay(copy);
}
export function validateUpcomingMissionDay(value,today=localDay(new Date())){
 const iso=String(value||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!/^\d{4}-\d{2}-\d{2}$/.test(today))
  throw Error('Choisissez une date future valide.');
 const start=new Date(today+'T12:00:00Z'),chosen=new Date(iso+'T12:00:00Z');
 if(Number.isNaN(start.getTime())||Number.isNaN(chosen.getTime())||chosen.toISOString().slice(0,10)!==iso||
  start.toISOString().slice(0,10)!==today||
  Math.round((chosen-start)/86400000)<1||Math.round((chosen-start)/86400000)>14)
  throw Error('Choisissez une journée de demain aux 14 prochains jours.');
 return iso;
}
