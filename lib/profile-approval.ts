// Publications predating the approval workflow stay visible until edited.
// Every new profile or content/photo mutation explicitly becomes pending.
export function approvalStatus(data:string):'pending'|'approved'|'rejected'{
  const value=JSON.parse(data).approvalStatus;
  return value===undefined?'approved':value==='approved'?'approved':value==='rejected'?'rejected':'pending';
}
export function approvedSql(alias='profiles'){
  return `coalesce(json_extract(${alias}.data,'$.approvalStatus'),'approved')='approved'`;
}
