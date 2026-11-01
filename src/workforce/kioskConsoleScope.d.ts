export interface KioskAccount {companyId:string;userId:string;role:string;edition?:string}
export interface KioskToken {identity:string;revision:number}
export interface KioskConsoleScope {
 matches(account:KioskAccount):boolean;
 current():KioskToken;
 enter(account:KioskAccount):KioskToken;
 invalidate():void;
 allows(token:KioskToken):boolean;
}
export interface KioskDevice {id:string;name:string;revoked_at?:string|null;idle_seconds?:number|null;paired_at?:string|null;last_seen_at?:string|null}
export interface KioskLocation {id:string;company_id:string;name:string;active:boolean}
export interface KioskWorker {id:string;company_id:string;status:string;role?:string;can_kiosk_punch:boolean;can_mobile_punch:boolean;[key:string]:any}
export function kioskConsoleIdentity(account:KioskAccount):string;
export function createKioskConsoleScope(account:KioskAccount):KioskConsoleScope;
export function mayManageKiosks(account:KioskAccount):boolean;
export function maySetWorkerChannels(account:KioskAccount):boolean;
export function validKioskDevices(rows:unknown,limit?:number):KioskDevice[];
export function validKioskLocations(rows:unknown,company:string,limit?:number):KioskLocation[];
export function validKioskWorkers(rows:unknown,company:string,limit?:number):KioskWorker[];
export function validPairingInput(location:string,name:string,locations:KioskLocation[]):{location:string;name:string};
export function canAlterKiosk(device:KioskDevice,devices:KioskDevice[],account:KioskAccount):boolean;
export function canAlterKioskWorker(worker:KioskWorker,workers:KioskWorker[],account:KioskAccount):boolean;
export function canEnrollKioskPin(worker:KioskWorker,workers:KioskWorker[],account:KioskAccount):boolean;
export const kioskIdleOptions:number[];
export function validKioskSecret(secret:unknown):string;
