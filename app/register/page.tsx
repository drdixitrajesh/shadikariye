import {CredentialsForm,PortalFrame} from '../portal/client';
export const metadata={title:'प्रोफ़ाइल पोस्ट करें | वैदिक मिलन',robots:{index:false,follow:false}};
export default function RegisterPage(){return <PortalFrame title="प्रोफ़ाइल पोस्ट करें / Post your profile"><p><a className="primary" href="/post">बिना लॉगिन आसान फॉर्म भरें</a></p><CredentialsForm registration/></PortalFrame>;}
