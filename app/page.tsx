import {getChatGPTUser,chatGPTSignInPath} from './chatgpt-auth';
import Milan from './milan';
import {env} from 'cloudflare:workers';
import {requiresAccountMobile} from '@/lib/mobile-access';
export const dynamic='force-dynamic';
export default async function Home(){const user=await getChatGPTUser();return <Milan signedIn={!!user} displayName={user?.fullName??''} standalone={env.STANDALONE_MODE==='test-portal'} publicRegistration={env.PUBLIC_REGISTRATION==='1'} mobileRequired={requiresAccountMobile()} signInPath={env.STANDALONE_MODE==='test-portal'?'/login':env.STANDALONE_MODE==='demo'?null:chatGPTSignInPath('/')} />;}

