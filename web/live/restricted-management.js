// Navigation guard only. Every data mutation remains authorized independently by Supabase.
const BLOCKED = new Set(['restricted', 'cancelled']);
export function isRestrictedManagement(account, billingSummary) {
  if (account?.companies?.product_edition !== 'essential') return false;
  const effective = billingSummary?.status ?? account.companies?.billing_status;
  return BLOCKED.has(effective);
}
export function canUseRestrictedManagement({role, action, id, section, sub}) {
  if (action === 'logout' || action === 'refresh') return true;
  if (action === 'navigate') {
    return id === 'home' || (role === 'boss' && ['punch', 'management'].includes(id));
  }
  if (action === 'subpage') {
    return id === 'support' || (role === 'boss' && id === 'billing');
  }
  if (action.startsWith('support:')) return section === 'sub' && sub === 'support';
  if (action.startsWith('bill:')) return role === 'boss' && section === 'sub' && sub === 'billing';
  return false;
}
