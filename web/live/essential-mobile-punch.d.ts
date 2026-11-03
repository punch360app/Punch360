/** Shared Web/Expo job assignment contract: a missing assigned location never falls back to default. */
export interface EssentialAssignedPunchWorker {
 location_id?:string|null;
}
export interface EssentialAssignedPunchLocation {
 id?:string;
 company_id?:string;
 punch_job_id?:string|null;
 active?:boolean;
}
export function essentialWorkerPunchJobId(
 companyId:string,
 worker:EssentialAssignedPunchWorker|null|undefined,
 locations:EssentialAssignedPunchLocation[]|null|undefined,
 defaultJobId?:string|null
):string|null;
