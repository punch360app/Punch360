export type MissingDayForm={worker:string;job:string;start:string;end:string;reason:string;breaks:{start:string;end:string;paid:boolean}[]};
export function blankMissingDay():MissingDayForm;
export function missingDayPayload(company:string,form:MissingDayForm):{p_company:string;p_worker:string;p_job:string;p_start:string;p_end:string;p_breaks:{start:string;end:string;paid:boolean}[];p_reason:string};
