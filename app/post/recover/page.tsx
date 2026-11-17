import {env} from 'cloudflare:workers';
import RecoveryForm from './recovery-form';
import '../post.css';
export const dynamic='force-dynamic';
export const metadata={title:'निजी प्रोफ़ाइल लिंक वापस पाएँ | वैदिक मिलन',robots:{index:false,follow:false}};
export default function RecoveryPage(){return <main className="post-page"><a href="/">वैदिक मिलन / Vedik Milan</a><h1>निजी प्रोफ़ाइल लिंक वापस पाएँ</h1><p>पोस्ट में दिया संपर्क मोबाइल लिखें। Admin मूल संपर्क से पहचान की पुष्टि करके नया लिंक देगा। OTP या SMS अपने आप नहीं भेजा जाएगा। नया लिंक बनने पर पुराना लिंक बंद हो जाएगा।</p><RecoveryForm siteKey={env.TURNSTILE_SITE_KEY??''}/></main>;}
