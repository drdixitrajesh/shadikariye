import {adminIdentity} from '@/lib/admin';
import {redirect} from 'next/navigation';
import PostForm from '../../post/post-form';
import '../../post/post.css';
export const dynamic='force-dynamic';
export default async function AdminPostPage(){if(!await adminIdentity())redirect('/account');return <main className="post-page"><a href="/admin">सभी सदस्य / Backoffice</a><PostForm admin/></main>;}
