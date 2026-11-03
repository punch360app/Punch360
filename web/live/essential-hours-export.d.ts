export interface AttendanceSegment {
 session_id:string;
 started_at:string;
 ended_at?:string|null;
}
export interface AttendanceBreak {
 session_id:string;
 is_paid?:boolean;
 started_at:string;
 ended_at?:string|null;
}
export function netSegmentMilliseconds(row:AttendanceSegment,breaks:AttendanceBreak[],from:number,until:number):number;
export function sessionIdChunks(rows:{session_id?:string|null}[],size?:number):string[][];
export function segmentExportDuration(row:AttendanceSegment,breaks?:AttendanceBreak[]):{
 gross:string;unpaid:string;net:string;anomaly:string;
};
