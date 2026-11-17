import PrivacyControl from './profile-manager';
import '../post.css';
export const metadata={title:'अपनी प्रोफ़ाइल सँभालें | वैदिक मिलन',robots:{index:false,follow:false}};
export default function PrivacyPage(){return <main className="post-page"><a href="/">वैदिक मिलन / Vedik Milan</a><PrivacyControl/></main>;}
