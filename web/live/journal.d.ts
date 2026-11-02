export type LocalPunchEvent={id:string;company:string;user:string;action:'in'|'out'|'transfer'|'break_start'|'break_end';job:string|null;fix:{latitude:number;longitude:number;accuracy:number|null}|null;occurredAt:string;paid?:boolean;offline:boolean;status:'pending'|'synced'|'conflict';result?:Record<string,any>;previous:string|null;error?:string};
export class PunchJournal {
 readonly company:string;readonly user:string;
 constructor(options:{withLock?:<T>(fn:()=>Promise<T>)=>Promise<T>;storage:{get:(key:string)=>Promise<string|null>;set:(key:string,value:string)=>Promise<void>};send:(event:LocalPunchEvent)=>Promise<Record<string,any>>;uuid:()=>string;company:string;user:string});
 read():Promise<LocalPunchEvent[]>;append(action:LocalPunchEvent['action'],job?:string|null,fix?:LocalPunchEvent['fix'],occurredAt?:string,paid?:boolean,offline?:boolean):Promise<LocalPunchEvent>;
 flush():Promise<{sent:number;events:LocalPunchEvent[];pending:number}>;
 /** Read and validate saved events without network I/O or rewriting them. */
 inspect():Promise<{sent:number;events:LocalPunchEvent[];pending:number}>;
 pending():Promise<LocalPunchEvent[]>;
}
export function projectPendingPunches<T extends {sessions:any[];segments:any[]}>(snapshot:T,events:LocalPunchEvent[],scope?:{company:string;user:string}|null):T & {breaks:any[];active:any;lastJobId:string|null;appliedLocalEvents:number};

/** Safeguard before append or flush; preserves unverified local events unchanged. */
export function hasUnsafePunchJournalEntries(events:unknown,company:string,user:string):boolean;
/** Invalid newly captured GPS data is treated as missing, never persisted. */
export function normalizeFreshPunchFix(fix:unknown):LocalPunchEvent['fix'];
