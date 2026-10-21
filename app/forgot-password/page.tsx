import {PortalFrame} from '../portal/client';
import RecoveryForm from '../portal/recovery';
export const metadata={title:'पासवर्ड भूल गए? | वैदिक मिलन',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function ForgotPasswordPage(){return <PortalFrame title="पासवर्ड भूल गए? / Forgot password?"><RecoveryForm/></PortalFrame>;}
