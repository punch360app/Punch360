/** Pure, verified-company selector logic shared between mobile and Web.
 * Accept only rows delivered by the active user's server-side RLS membership query.
 * Never use an email, local role hint, or browser-provided company ID as authority.
 */
const roles=new Set(['employee','lead','admin','boss']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function listVerifiedWorkspaces(memberships,user){
 if(!user?.id||!Array.isArray(memberships))return [];
 const found=new Set(),result=[];
 for(const member of memberships){
  if(member?.status!=='active'||!uuid.test(member.company_id||'')||!roles.has(member.role)||found.has(member.company_id))continue;
  if(member.user_id&&member.user_id!==user.id)continue;
  const company=Array.isArray(member.companies)?member.companies[0]:member.companies;
  if(!company||!['essential','construction'].includes(company.product_edition))continue;
  // The tenant ID is taken from the RLS-protected company_members row, not company metadata.
  found.add(member.company_id);
  result.push({
   companyId:member.company_id,companyName:company.name||'Ma compagnie',
   role:member.role,userId:user.id,email:user.email||'',
   billingStatus:company.billing_status||'setup',edition:company.product_edition,
   defaultJobId:company.default_punch_job_id||null
  });
 }
 return result.sort((a,b)=>a.companyName.localeCompare(b.companyName,'fr')||a.companyId.localeCompare(b.companyId));
}
export function chooseVerifiedWorkspace(workspaces,requestedCompanyId){
 if(!Array.isArray(workspaces)||!workspaces.length)return null;
 return workspaces.find(x=>x.companyId===requestedCompanyId)??(workspaces.length===1?workspaces[0]:null);
}
