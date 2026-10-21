import type {Metadata} from 'next';
import './globals.css';
import PhotoCopyGuard from './photo-copy-guard';
export const metadata:Metadata={title:'Vedik Milan | Free Brahmin Matrimony',description:'पूरी तरह निःशुल्क ब्राह्मण विवाह। समुदाय और गोत्र से रिश्ते खोजें, अपनी सहमति से प्रोफ़ाइल बनाएं और परिचय करें।',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="hi"><body><PhotoCopyGuard/>{children}</body></html>;}

