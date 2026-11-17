import type {BirthInput,KundaliResult} from './kundali';
import {imagePdf} from './image-pdf';
type ReportData={groom:BirthInput;bride:BirthInput;result:KundaliResult;rashis:readonly string[];nakshatras:readonly string[]};
let fontReady:Promise<void>|undefined;
function loadFont(){return fontReady??=(async()=>{const font=new FontFace('Kundali Report','url(/fonts/NotoSansDevanagari.ttf)',{weight:'100 900'});await font.load();document.fonts.add(font);})().catch(e=>{fontReady=undefined;throw e;});}
/** Canvas uses the browser's Devanagari shaping; PDF embeds these high-resolution pages. */
export async function createKundaliPdf(data:ReportData):Promise<File>{
  await loadFont();
  const width=1240,height=1754,margin=85,bottom=height-110,available=width-2*margin;
  const pages:HTMLCanvasElement[]=[];let canvas:HTMLCanvasElement,ctx:CanvasRenderingContext2D,y=0;
  const clean=(text:string)=>text.replace(/[\r\n\t\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g,' ').trim();
  const font=(size=26,bold=false)=>{ctx.font=`${bold?600:400} ${size}px "Kundali Report", sans-serif`;ctx.textBaseline='top';};
  const newPage=()=>{canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;pages.push(canvas);ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.fillStyle='#68384c';font(24,true);ctx.fillText('वैदिक मिलन  |  कुण्डली मिलान',margin,44);ctx.fillStyle='#dedbd7';ctx.fillRect(margin,91,available,2);y=124;};
  const ensure=(space:number)=>{if(y+space>bottom)newPage();};
  const wrap=(text:string,max:number,size=26,bold=false)=>{font(size,bold);const lines:string[]=[];let current='';const words=clean(text).split(/\s+/);const segmenter=new Intl.Segmenter('hi',{granularity:'grapheme'});for(const word of words){const next=current?current+' '+word:word;if(ctx.measureText(next).width<=max){current=next;continue;}if(current){lines.push(current);current='';}for(const {segment}of segmenter.segment(word)){if(current&&ctx.measureText(current+segment).width>max){lines.push(current);current='';}current+=segment;}}if(current)lines.push(current);return lines.length?lines:[''];};
  const paragraph=(text:string,size=26,bold=false,color='#2d2630',gap=10)=>{const lines=wrap(text,available,size,bold);if(lines.length*size*1.55+gap<bottom-124)ensure(lines.length*size*1.55+gap);for(const line of lines){ensure(size*1.65);font(size,bold);ctx.fillStyle=color;ctx.fillText(line,margin,y);y+=size*1.55;}y+=gap;};
  newPage();paragraph('अष्टकूट मिलान की रिपोर्ट',36,true,'#68384c',12);
  paragraph(data.result.boundary?'सीमा के पास चन्द्र स्थिति: गुणों की पुष्टि आवश्यक':`कुल मिलान: ${data.result.total} / 36 गुण`,30,true,'#68384c',22);
  if(data.result.boundary)paragraph('अभी निश्चित अंक न मानें। सही जन्म समय और पंचांग से पुष्टि कराएँ।',25,true,'#9b303d');
  for(const [kind,input,chart]of [['वर',data.groom,data.result.groom],['वधू',data.bride,data.result.bride]] as const){
    ensure(225);paragraph(`${kind}: ${input.name.trim()||'नाम नहीं दिया गया'}`,29,true,'#68384c',6);
    paragraph(`जन्म: ${input.date} | ${input.time} | ${input.place}`,25,false,'#2d2630',3);
    paragraph(`समय क्षेत्र: ${input.zone}${input.fold&&input.fold!=='reject'?` | दोहराया समय: ${input.fold==='earlier'?'पहली बार':'दूसरी बार'}`:''}`,23,false,'#68616a',3);
    paragraph(`चन्द्र राशि: ${data.rashis[chart.rashi]} | नक्षत्र: ${data.nakshatras[chart.nakshatra]} | चरण: ${chart.pada}`,25,false,'#2d2630',20);
  }
  ensure(180);paragraph('आठ कूटों के मूल गुण',29,true,'#68384c',8);
  const columns=[155,330,330,255];
  const row=(values:string[],header=false)=>{const lines=values.map((v,i)=>wrap(v,columns[i]-24,24,header));const rowHeight=Math.max(...lines.map(l=>l.length))*35+18;if(y+rowHeight>bottom){newPage();if(!header)row(['कूट','वर','वधू','गुण'],true);}ctx.fillStyle=header?'#f0e8eb':'#ffffff';ctx.fillRect(margin,y,available,rowHeight);let x=margin;for(let col=0;col<4;col++){font(24,header);ctx.fillStyle='#2d2630';lines[col].forEach((line,i)=>ctx.fillText(line,x+12,y+9+i*35));x+=columns[col];}y+=rowHeight;ctx.fillStyle='#dedbd7';ctx.fillRect(margin,y-1,available,1);};
  row(['कूट','वर','वधू','गुण'],true);
  data.result.kootas.forEach(k=>row([k.name,k.groom,k.bride,`${data.result.boundary?'-':k.points} / ${k.max}`]));
  row(['कुल','','',`${data.result.boundary?'-':data.result.total} / 36`],true);y+=24;
  for(const note of data.result.notes)paragraph(note,25,false,'#2d2630',14);
  paragraph('रिपोर्ट को समझें',28,true,'#68384c',6);
  paragraph('यह 36 गुणों का अष्टकूट मिलान है; पूर्ण कुण्डली, लग्न, मंगल दोष और दोष-परिहार की जाँच इसमें शामिल नहीं है। वर्ण आदि चन्द्र राशि के पारंपरिक वर्ग हैं, व्यक्ति की वास्तविक जाति नहीं।',23,false,'#68616a');
  paragraph('अलग परंपराओं के कारण गुण बदल सकते हैं। किसी रिश्ते का निर्णय केवल इस अंक पर न लें। यह स्वास्थ्य, संतान या वैवाहिक जीवन की भविष्यवाणी नहीं है।',23,false,'#68616a');
  paragraph('गणना: Astronomy Engine 2.1.19, भूकेन्द्रीय चन्द्र स्थिति और अनुमानित लाहिड़ी अयनांश। सीमा के पास परिणाम की अलग पुष्टि आवश्यक है।',22,false,'#68616a');
  paragraph('विधि व सीमाएँ: vedik-milan.softinator.org/kundali-milan',22,false,'#68616a');
  paragraph('जन्म विवरण निजी हैं। यह रिपोर्ट केवल संबंधित व्यक्तियों की सहमति से साझा करें।',23,true,'#68384c');
  const stamp=new Date().toLocaleDateString('en-IN');
  const images=await Promise.all(pages.map(async(page,i)=>{const context=page.getContext('2d')!;context.fillStyle='#68616a';context.font='400 20px "Kundali Report", sans-serif';context.fillText(`वैदिक मिलन | ${stamp}`,margin,height-63);context.textAlign='right';context.fillText(`पृष्ठ ${i+1} / ${pages.length}`,width-margin,height-63);context.textAlign='left';const blob=await new Promise<Blob>((resolve,reject)=>page.toBlob(b=>b?resolve(b):reject(new Error('PDF चित्र नहीं बना।')),'image/jpeg',.92));return {bytes:new Uint8Array(await blob.arrayBuffer()),width,height};}));
  const bytes=imagePdf(images);
  return new File([bytes.buffer as ArrayBuffer],'vedik-milan-kundali.pdf',{type:'application/pdf'});
}
