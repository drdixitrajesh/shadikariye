import {getChatGPTUser,chatGPTSignInPath} from './chatgpt-auth';
import Milan from './milan';
import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export default async function Home(){const user=await getChatGPTUser();return <Milan signedIn={!!user} displayName={user?.fullName??''} standalone={env.STANDALONE_MODE==='test-portal'} signInPath={env.STANDALONE_MODE==='test-portal'?'/login':env.STANDALONE_MODE==='demo'?null:chatGPTSignInPath('/')} />;}

