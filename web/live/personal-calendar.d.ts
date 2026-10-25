export interface CalendarShift {
 id: string;
 company_id: string;
 worker_id: string | null;
 starts_at: string;
 ends_at: string;
 cancelled_at?: string | null;
 location_id?: string | null;
 version?: number;
}
export interface CalendarLocation { id: string; company_id?: string; name?: string; }
export function buildPersonalCalendar(args: {companyId: string; workerId: string; companyName?: string; shifts?: CalendarShift[]; locations?: CalendarLocation[]; now?: Date | string}): {content: string; count: number; truncated: boolean};
export function downloadCalendarIcs(args: {content: string; document?: Document; urlApi?: typeof URL; BlobType?: typeof Blob}): void;
