import type {LocalPunchEvent} from './journal.js';
export type LocalPunchDisplayItem={label:string;occurredAt:string|null};
export function isOwnPunchJournalEvent(event:unknown,companyId:string,userId:string):boolean;
export function localPunchSyncState(events:LocalPunchEvent[]|unknown,companyId:string,userId:string):{
 pending:LocalPunchDisplayItem[];conflicts:LocalPunchDisplayItem[]
};
export function localPunchStatusSummary(options?:{events?:LocalPunchEvent[]|unknown;companyId?:string;userId?:string;snapshotCompanyId?:string|null;snapshotFetchedAt?:number|null}):{
 kind:'mixed'|'conflict'|'pending'|'server'|'unverified';label:string
};
