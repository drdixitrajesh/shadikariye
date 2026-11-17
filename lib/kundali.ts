// Geocentric Moon: Astronomy Engine (MIT). Rules and conventions: docs/kundali-method.md.
import {AstroTime,EclipticGeoMoon,e_tilt} from 'astronomy-engine';
export const RASHIS=['मेष','वृषभ','मिथुन','कर्क','सिंह','कन्या','तुला','वृश्चिक','धनु','मकर','कुम्भ','मीन'];
export const NAKSHATRAS=['अश्विनी','भरणी','कृत्तिका','रोहिणी','मृगशिरा','आर्द्रा','पुनर्वसु','पुष्य','आश्लेषा','मघा','पूर्वा फाल्गुनी','उत्तरा फाल्गुनी','हस्त','चित्रा','स्वाती','विशाखा','अनुराधा','ज्येष्ठा','मूल','पूर्वाषाढ़ा','उत्तराषाढ़ा','श्रवण','धनिष्ठा','शतभिषा','पूर्वाभाद्रपद','उत्तराभाद्रपद','रेवती'];
export type BirthInput={name:string;date:string;time:string;place:string;zone:string;fold?:'reject'|'earlier'|'later'};
export type MoonChart={longitude:number;rashi:number;nakshatra:number;pada:number;nearBoundary:boolean;utc:string;ayanamsa:number};
export type Koota={name:string;points:number;max:number;bride:string;groom:string};
export type KundaliResult={bride:MoonChart;groom:MoonChart;kootas:Koota[];total:number;boundary:boolean;notes:string[]};
const normalize=(x:number)=>((x%360)+360)%360;
function dateParts(value:Date,zone:string){
  const fmt=new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const p=Object.fromEntries(fmt.formatToParts(value).map(x=>[x.type,x.value]));
  return [Number(p.year),Number(p.month),Number(p.day),Number(p.hour),Number(p.minute),Number(p.second)];
}
export function birthUtc(input:BirthInput,now=new Date()):Date{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!/^\d{2}:\d{2}$/.test(input.time))throw new Error('जन्म तिथि और सही जन्म समय भरें।');
  const [y,m,d]=input.date.split('-').map(Number),[h,min]=input.time.split(':').map(Number);
  const target=Date.UTC(y,m-1,d,h,min),test=new Date(target);
  if(y<1900||y>2099||h>23||min>59||test.getUTCFullYear()!==y||test.getUTCMonth()!==m-1||test.getUTCDate()!==d)throw new Error('सही जन्म तिथि और समय दें (वर्ष 1900–2099)।');
  if(!input.place.trim()||input.place.length>100)throw new Error('जन्म का शहर / गाँव भरें (अधिकतम 100 अक्षर)।');
  if(!input.zone||input.zone.length>80)throw new Error('जन्म स्थान का सही समय क्षेत्र चुनें।');
  // Collect actual historical zone offsets on both sides of the local date.
  // Round-trip validation rejects skipped clocks; multiple matches require an explicit choice.
  const offsets=new Set<number>();
  try{for(let delta=-36;delta<=36;delta+=6){const instant=new Date(target+delta*3600000),p=dateParts(instant,input.zone);offsets.add(Date.UTC(p[0],p[1]-1,p[2],p[3],p[4],p[5])-instant.getTime());}}catch{throw new Error('समय क्षेत्र सही नहीं है। उदाहरण: भारत के लिए Asia/Kolkata।');}
  const expected=[y,m,d,h,min,0].join(','),matches=[...offsets].map(offset=>new Date(target-offset)).filter(t=>dateParts(t,input.zone).join(',')===expected).sort((a,b)=>+a-+b);
  if(!matches.length)throw new Error('इस स्थान पर घड़ी बदलने के कारण यह स्थानीय समय मौजूद नहीं था। जन्म रिकॉर्ड का समय जाँचें।');
  if(matches.length>1&&!['earlier','later'].includes(input.fold??''))throw new Error('घड़ी बदलने से यह समय दो बार आया था। समय क्षेत्र के नीचे पहली या दूसरी बार का विकल्प चुनें।');
  const result=input.fold==='later'?matches[matches.length-1]:matches[0];
  if(result>now)throw new Error('जन्म की तिथि और समय भविष्य के नहीं हो सकते।');
  return result;
}
// IAU 2006 general precession in longitude, arcseconds from J2000.
function precession(t:number){return 5028.796195*t+1.1054348*t*t+.00007964*t**3-.000023857*t**4-.0000000383*t**5;}
export function lahiriAyanamsa(date:Date){
  const time=new AstroTime(date),t=time.tt/36525;
  // Published Lahiri reference: JD 2415020.0, 22.46047 degrees.
  // Nutation must be added because EclipticGeoMoon returns true ecliptic of date.
  return 22.46047+(precession(t)-precession(-1))/3600+e_tilt(time).dpsi/3600;
}
export function chartFromLongitude(longitude:number):Omit<MoonChart,'utc'|'ayanamsa'>{
  if(!Number.isFinite(longitude))throw new Error('चन्द्र स्थिति की गणना उपलब्ध नहीं है।');
  const lon=normalize(longitude),rashi=Math.floor(lon/30),segment=lon*3/40,nakshatra=Math.min(26,Math.floor(segment+1e-12)),pada=Math.min(4,Math.floor(Math.max(0,segment-nakshatra)*4+1e-12)+1);
  // Suppress definite scores within 0.05 degrees of any classification boundary.
  const distance=(step:number)=>Math.min(lon%step,step-lon%step);
  return {longitude:lon,rashi,nakshatra,pada,nearBoundary:Math.min(distance(30),distance(40/3),distance(10/3))<.05};
}
export function moonChart(input:BirthInput):MoonChart{const date=birthUtc(input),ayanamsa=lahiriAyanamsa(date);return {...chartFromLongitude(EclipticGeoMoon(date).lon-ayanamsa),utc:date.toISOString(),ayanamsa};}
const GANA=[0,1,2,1,0,1,0,0,2,2,1,1,0,2,0,2,0,2,2,1,1,0,2,2,1,1,0];
const NADI=[0,1,2,2,1,0,0,1,2,2,1,0,0,1,2,2,1,0,0,1,2,2,1,0,0,1,2];
const YONI=[0,1,2,3,3,4,5,2,5,6,6,7,8,9,8,9,10,10,4,11,12,11,13,0,13,7,1];
const YONI_NAMES=['अश्व','गज','मेष','सर्प','श्वान','मार्जार','मूषक','गौ','महिष','व्याघ्र','मृग','वानर','नकुल','सिंह'];
// Bride rows, groom columns. Published Muhurta Chintamani convention, not a symmetric approximation.
const YONI_POINTS=[
 [4,2,3,2,2,3,3,3,0,1,3,2,2,1],
 [2,4,3,2,2,3,3,3,3,2,2,2,2,0],
 [3,3,4,3,2,3,1,3,3,1,3,0,3,1],
 [2,2,3,4,2,2,1,1,2,2,2,2,0,2],
 [2,2,2,2,4,1,1,2,2,1,0,2,2,1],
 [2,2,3,2,1,4,0,2,2,1,2,2,2,2],
 [2,2,2,1,1,0,4,2,2,2,2,2,2,1],
 [3,2,3,1,2,2,2,4,3,0,3,2,3,1],
 [0,3,3,2,2,2,2,3,4,1,2,2,2,3],
 [1,2,1,2,1,1,2,0,1,4,2,1,2,2],
 [3,2,3,2,0,2,2,3,2,1,4,2,2,2],
 [2,3,0,2,2,2,2,2,2,1,2,4,2,3],
 [2,2,3,0,2,2,2,3,2,2,2,2,4,2],
 [1,0,1,2,1,2,1,1,3,2,2,2,2,4],
];
const LORDS=[2,5,3,1,0,3,5,2,4,6,6,4],LORD_NAMES=['सूर्य','चन्द्र','मंगल','बुध','गुरु','शुक्र','शनि'];
const MAITRI=[[5,5,5,4,5,0,0],[5,5,4,1,4,.5,.5],[5,4,5,.5,5,3,.5],[4,1,.5,5,.5,5,4],[5,4,5,.5,5,.5,3],[0,.5,3,5,.5,5,5],[0,.5,.5,4,3,5,5]];
const VARNA=[2,1,0,3,2,1,0,3,2,1,0,3],VARNA_NAMES=['शूद्र','वैश्य','क्षत्रिय','ब्राह्मण'];
// Four-group Vashya convention of the specified commentary (not the five-group variant).
const VASHYA=[1,1,0,2,1,0,0,3,1,2,2,2],VASHYA_NAMES=['द्विपद','चतुष्पद','जलचर','कीट'];
const VASHYA_POINTS=[[2,.5,.5,1],[.5,2,2,2],[.5,2,2,2],[1,2,2,2]];
const GANA_POINTS=[[6,5,1],[6,6,0],[0,0,6]],GANA_NAMES=['देव','मनुष्य','राक्षस'],NADI_NAMES=['आदि','मध्य','अन्त्य'];
export function scoreCharts(bride:MoonChart,groom:MoonChart):Koota[]{
  for(const c of [bride,groom])if(!Number.isInteger(c.rashi)||c.rashi<0||c.rashi>11||!Number.isInteger(c.nakshatra)||c.nakshatra<0||c.nakshatra>26)throw new Error('अमान्य राशि या नक्षत्र।');
  const b=bride.rashi,g=groom.rashi,bn=bride.nakshatra,gn=groom.nakshatra;
  const tara=(from:number,to:number)=>((to-from+27)%27+1)%9;
  const good=(value:number)=>![3,5,7].includes(value),bt=tara(bn,gn),gt=tara(gn,bn);
  const distance=(g-b+12)%12+1;
  return [
    {name:'वर्ण',max:1,points:VARNA[g]>=VARNA[b]?1:0,bride:VARNA_NAMES[VARNA[b]],groom:VARNA_NAMES[VARNA[g]]},
    {name:'वश्य',max:2,points:VASHYA_POINTS[VASHYA[b]][VASHYA[g]],bride:VASHYA_NAMES[VASHYA[b]],groom:VASHYA_NAMES[VASHYA[g]]},
    {name:'तारा',max:3,points:(good(bt)?1.5:0)+(good(gt)?1.5:0),bride:String(bt||9),groom:String(gt||9)},
    {name:'योनि',max:4,points:YONI_POINTS[YONI[bn]][YONI[gn]],bride:YONI_NAMES[YONI[bn]],groom:YONI_NAMES[YONI[gn]]},
    {name:'ग्रह मैत्री',max:5,points:MAITRI[LORDS[b]][LORDS[g]],bride:LORD_NAMES[LORDS[b]],groom:LORD_NAMES[LORDS[g]]},
    {name:'गण',max:6,points:GANA_POINTS[GANA[bn]][GANA[gn]],bride:GANA_NAMES[GANA[bn]],groom:GANA_NAMES[GANA[gn]]},
    {name:'भकूट',max:7,points:[2,12,5,9,6,8].includes(distance)?0:7,bride:RASHIS[b],groom:RASHIS[g]},
    {name:'नाड़ी',max:8,points:NADI[bn]===NADI[gn]?0:8,bride:NADI_NAMES[NADI[bn]],groom:NADI_NAMES[NADI[gn]]},
  ];
}
export function matchKundali(brideInput:BirthInput,groomInput:BirthInput):KundaliResult{
  const bride=moonChart(brideInput),groom=moonChart(groomInput),kootas=scoreCharts(bride,groom),notes:string[]=[];
  if(kootas[7].points===0)notes.push('नाड़ी कूट में 0 गुण हैं। इस पारंपरिक संकेत की विस्तृत समीक्षा कराएँ।');
  if(kootas[6].points===0)notes.push('भकूट कूट में 0 गुण हैं। पूर्ण कुण्डली और परिहार की अलग समीक्षा आवश्यक है।');
  if(bride.nearBoundary||groom.nearBoundary)notes.push('चन्द्रमा राशि, नक्षत्र या चरण की सीमा के पास है। जन्म समय या गणना के छोटे अंतर से परिणाम बदल सकता है; इसलिए निश्चित गुण नहीं दिखाए गए हैं।');
  return {bride,groom,kootas,total:kootas.reduce((sum,k)=>sum+k.points,0),boundary:bride.nearBoundary||groom.nearBoundary,notes};
}
