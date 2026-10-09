import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {isAdmin} from '@/lib/admin';
import {redirect} from 'next/navigation';
import {env} from 'cloudflare:workers';
import AdminProfiles from './profiles';
export const dynamic='force-dynamic';
export const metadata={title:'प्रोफ़ाइल प्रशासन | वैदिक मिलन',robots:{index:false,follow:false}};
export default async function AdminPage(){
  const user=await getChatGPTUser();if(!user)redirect(env.STANDALONE_MODE==='test-portal'?'/account':chatGPTSignInPath('/admin'));
  if(!isAdmin(user))return <main className="legal-page"><h1>Administrator access required / प्रशासक की अनुमति आवश्यक है</h1><p>Only configured administrators can manage other members’ profiles. / केवल अधिकृत प्रशासक अन्य सदस्यों की प्रोफ़ाइल हटा सकते हैं।</p><a href="/">Back to website / वेबसाइट पर जाएं</a></main>;
  return <AdminProfiles standalone={env.STANDALONE_MODE==='test-portal'}/>;
}
