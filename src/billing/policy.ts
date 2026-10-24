/**
 * PUNCH — Calculs de prix et états de facturation.
 * Source autonome, sans dépendance Stripe.
 * Tous les montants sont exprimés en cents CAD.
 */
export interface PricingConfig {
  baseCents: number;
  seatsIncluded: number;
  extraSeatCents: number;
  annualDiscountPercent: number;
  graceDays: number;
}
export const defaultPricing: PricingConfig = {
  baseCents: 4900,
  seatsIncluded: 5,
  extraSeatCents: 700,
  annualDiscountPercent: 15,
  graceDays: 30,
};

export type Cadence = "monthly" | "yearly";
export function quote(seats: number, config: PricingConfig = defaultPricing, cadence: Cadence = "monthly") {
  if (!Number.isSafeInteger(seats) || seats < 1) throw Error("Invalid seats");
  if (!Number.isSafeInteger(config.baseCents) || config.baseCents < 0
   || !Number.isSafeInteger(config.extraSeatCents) || config.extraSeatCents < 0
   || !Number.isSafeInteger(config.seatsIncluded) || config.seatsIncluded < 1
   || config.annualDiscountPercent < 0 || config.annualDiscountPercent > 100) throw Error("Invalid pricing");
  const extraSeats = Math.max(0, seats - config.seatsIncluded);
  const monthlyCents = config.baseCents + extraSeats * config.extraSeatCents;
  const annualCents = Math.round(monthlyCents * 12 * (1 - config.annualDiscountPercent / 100));
  return { seats, extraSeats, monthlyCents, annualCents, dueCents: cadence === "yearly" ? annualCents : monthlyCents };
}
export interface BillingSnapshot {
  paidThrough: string | null;       // ISO datetime: end of already-paid service period
  firstUnpaidAt: string | null;    // ISO datetime: first failed/unpaid renewal, never reset on retries
  canceled: boolean;              // voluntary termination (when paid-through elapses)
  manualAccessUntil?: string | null; // platform-admin exception
}
export type Entitlement = "active" | "grace" | "override" | "restricted";
function timestamp(iso: string | null | undefined): number {
  if (!iso) return -Infinity;
  const n = Date.parse(iso);
  if (!Number.isFinite(n)) throw Error("Invalid timestamp");
  return n;
}
/** This is a billing entitlement, not permission to view individual labor records. */
export function accessState(snapshot: BillingSnapshot, now: string, graceDays = 30): Entitlement {
  const t = timestamp(now);
  if (!Number.isInteger(graceDays) || graceDays < 0) throw Error("Invalid grace");
  if (t < timestamp(snapshot.paidThrough)) return "active";
  if (t < timestamp(snapshot.manualAccessUntil)) return "override";
  if (!snapshot.canceled && snapshot.firstUnpaidAt && t < timestamp(snapshot.firstUnpaidAt) + graceDays * 86400000) return "grace";
  return "restricted";
}
