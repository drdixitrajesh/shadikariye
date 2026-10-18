import {adminIdentity} from '@/lib/admin';
import {redirect} from 'next/navigation';
import MemberDetail from '../../member-detail';
export const dynamic='force-dynamic';
export const metadata={title:'सदस्य की जानकारी | वैदिक मिलन',robots:{index:false,follow:false}};
export default async function MemberPage({params}:{params:Promise<{id:string}>}){
  if(!await adminIdentity())redirect('/account');
  const {id}=await params;
  return <MemberDetail id={id}/>;
}
