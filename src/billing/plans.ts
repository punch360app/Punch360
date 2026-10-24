import type {PricingConfig} from './policy';
export type ProductEdition='essential'|'construction';
/** Proposed pricing only; never grants seats or changes server payment state. */
export const proposedPlans:Record<ProductEdition,{name:string;audience:string;pricing:PricingConfig;features:string[]}>= {
 essential:{name:'PUNCH Essentiel',audience:'Bureaux, ateliers et manufactures',pricing:{baseCents:1900,seatsIncluded:5,extraSeatCents:300,annualDiscountPercent:15,graceDays:30},features:['punch','unpaid_breaks','hours','schedules','leave','approvals','csv','offline','geofence']},
 construction:{name:'PUNCH Construction',audience:'Chantiers et équipes mobiles',pricing:{baseCents:4900,seatsIncluded:5,extraSeatCents:700,annualDiscountPercent:15,graceDays:30},features:['punch','hours','schedules','leave','approvals','csv','offline','geofence','jobs','orders','plans','teams','messages']}
};
