import {getChatGPTUser,chatGPTSignInPath} from './chatgpt-auth';
import Milan from './milan';
export const dynamic='force-dynamic';
export default async function Home(){const user=await getChatGPTUser();return <Milan signedIn={!!user} displayName={user?.fullName??''} signInPath={chatGPTSignInPath('/')} />;}

