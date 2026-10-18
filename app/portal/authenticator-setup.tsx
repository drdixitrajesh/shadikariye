'use client';
import {QRCodeSVG} from 'qrcode.react';

export default function AuthenticatorSetup({secret,uri,onCopy}:{secret:string;uri:string;onCopy:(value:string)=>void}){
  return <>
    <p>अपने फोन में Google Authenticator या Microsoft Authenticator खोलें। + दबाकर “Scan a QR code” चुनें और यह QR स्कैन करें। फिर नीचे ऐप का छह अंक वाला कोड भरें। / In your authenticator app, tap +, scan this QR code, then enter the six-digit code below.</p>
    <figure className="mfa-qr">
      <QRCodeSVG value={uri} size={256} level="M" marginSize={4} title="Authenticator सेटअप QR कोड / Authenticator setup QR code"/>
      <figcaption>यह निजी QR केवल अपने authenticator ऐप में स्कैन करें। / Keep this QR private.</figcaption>
    </figure>
    <details className="mfa-manual">
      <summary>उसी फोन पर सेटअप कर रहे हैं या स्कैन नहीं हो रहा? / On the same phone or unable to scan?</summary>
      <p>ऐप में “Enter a setup key” चुनें। खाता नाम drdixitrajesh, कुंजी नीचे वाली और प्रकार “Time based” रखें। / Choose “Enter a setup key” in your app and select “Time based”.</p>
      <div className="field"><label htmlFor="mfa-secret">सेटअप कुंजी / Setup key</label><input id="mfa-secret" readOnly autoComplete="off" value={secret}/><button type="button" className="text-button" onClick={()=>onCopy(secret)}>कुंजी कॉपी करें / Copy key</button></div>
      <div className="field"><label htmlFor="mfa-uri">Authenticator सेटअप लिंक / Authenticator setup URI</label><textarea id="mfa-uri" readOnly rows={3} value={uri}/><button type="button" className="text-button" onClick={()=>onCopy(uri)}>सेटअप लिंक कॉपी करें / Copy setup URI</button></div>
    </details>
  </>;
}
