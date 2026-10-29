export interface SupportScope {
  enter(companyId:string):number;
  invalidate():number;
  current():{company:string;epoch:number};
  allows(companyId:string,token:number):boolean;
}
export function createSupportScope(initialCompany:string):SupportScope;
