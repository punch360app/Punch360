export interface SupportScope {
  enter(companyId:string):number;
  invalidate():number;
  current():{company:string;epoch:number};
  allows(companyId:string,token:number):boolean;
}
export function createSupportScope(initialCompany:string):SupportScope;

export interface SupportAccount {
 companyId:string;
 userId:string;
 role:string;
 edition?:string;
}
export interface SupportAccountToken {identity:string;epoch:number}
export interface SupportAccountScope {
 current():SupportAccountToken;
 matches(account:SupportAccount):boolean;
 enter(account:SupportAccount):SupportAccountToken;
 invalidate():void;
 allows(token:SupportAccountToken):boolean;
}
export function supportAccountIdentity(account:SupportAccount):string;
export function createSupportAccountScope(account:SupportAccount):SupportAccountScope;
export function safeSupportTicketPage(rows:unknown,account:SupportAccount):any[];
export function safeSupportTicketDetail(ticket:unknown,account:SupportAccount,limit?:number):any;
export function isKnownSupportTicket(id:string,tickets:readonly {id:string}[]):boolean;
