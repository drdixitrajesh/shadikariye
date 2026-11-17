import {env} from 'cloudflare:workers';
import PostForm from './post-form';
import './post.css';
export const dynamic='force-dynamic';
export const metadata={title:'बिना लॉगिन प्रोफ़ाइल पोस्ट करें | वैदिक मिलन',robots:{index:false,follow:false}};
export default function PostPage(){return <main className="post-page"><a href="/">वैदिक मिलन / Vedik Milan</a><PostForm siteKey={env.TURNSTILE_SITE_KEY??''}/></main>;}
