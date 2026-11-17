import type {Metadata} from 'next';
import './globals.css';
import {PwaRuntime} from './pwa-runtime';
import PhotoCopyGuard from './photo-copy-guard';
export const metadata:Metadata={title:'Vedik Milan | Free Brahmin Matrimony',description:'पूरी तरह निःशुल्क ब्राह्मण विवाह। समुदाय और गोत्र से रिश्ते खोजें, अपनी सहमति से प्रोफ़ाइल बनाएं और परिचय करें।',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'वैदिक मिलन',statusBarStyle:'default'},icons:{icon:'/favicon.svg',shortcut:'/favicon.svg',apple:'/icons/app-180.png'}};
export const viewport={width:'device-width',initialScale:1,themeColor:'#68384c'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="hi"><body><PhotoCopyGuard/><PwaRuntime/>{children}</body></html>;}

