import type {PricingConfig} from './policy';
export type ProductEdition='essential'|'construction';
/** Proposed pricing only; never grants seats or changes server payment state. */
export const proposedPlans:Record<ProductEdition,{name:string;audience:string;pricing:PricingConfig;features:string[]}>= {
 essential:{name:'PUNCH Essentiel',audience:'Bureaux, ateliers et manufactures',pricing:{baseCents:1900,seatsIncluded:5,extraSeatCents:300,annualDiscountPercent:15,graceDays:30},features:['punch','unpaid_breaks','hours','schedules','leave','approvals','csv','offline','geofence']},
 construction:{name:'PUNCH Construction',audience:'Chantiers et équipes mobiles',pricing:{baseCents:4900,seatsIncluded:5,extraSeatCents:700,annualDiscountPercent:15,graceDays:30},features:['punch','hours','schedules','leave','approvals','csv','offline','geofence','jobs','orders','plans','teams','messages']}
};

export type EssentialTier = 'essential' | 'essential_plus' | 'essential_pro';
export interface EssentialPlan {
 id: EssentialTier;
 name: string;
 pricing: PricingConfig;
 kioskLimit: number | null;
 establishmentLimit: number | null;
 recommended: boolean;
 features: readonly string[];
}
/** Initial catalogue seeds only. Public/contract pricing must be loaded from the
 * server. These objects never grant entitlements or override a signed contract. */
const essentialCore = ['punch', 'paid_breaks', 'unpaid_breaks', 'hours', 'schedules',
 'leave', 'approvals', 'csv', 'offline', 'geofence', 'kiosk', 'mixed_punch',
 'personal_account', 'themes', 'sms_invitations', 'email_invitations'] as const;
const plusFeatures = [...essentialCore, 'advanced_schedules', 'shift_swaps',
 'availability', 'departments', 'supervisors', 'announcements', 'messages',
 'schedule_acknowledgements'] as const;
export const essentialPlanSeeds: readonly EssentialPlan[] = [
 {id:'essential',name:'Essentiel',pricing:{baseCents:1900,seatsIncluded:5,extraSeatCents:300,annualDiscountPercent:15,graceDays:30},kioskLimit:1,establishmentLimit:1,recommended:false,features:essentialCore},
 {id:'essential_plus',name:'Essentiel Plus',pricing:{baseCents:3900,seatsIncluded:5,extraSeatCents:400,annualDiscountPercent:15,graceDays:30},kioskLimit:3,establishmentLimit:1,recommended:true,features:plusFeatures},
 {id:'essential_pro',name:'Essentiel Pro',pricing:{baseCents:6900,seatsIncluded:5,extraSeatCents:500,annualDiscountPercent:15,graceDays:30},kioskLimit:null,establishmentLimit:null,recommended:false,features:[...plusFeatures,'minimum_coverage','hr_documents','certifications','advanced_reports','time_banks','labor_costs','payroll_integrations','multiple_establishments']}
];
