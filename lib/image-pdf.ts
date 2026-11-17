/** Minimal PDF container for browser-rendered JPEG pages. No document data leaves the device. */
export function imagePdf(pages:{bytes:Uint8Array;width:number;height:number}[]):Uint8Array{
  if(!pages.length)throw new Error('PDF needs at least one page');
  const encoder=new TextEncoder(),parts:Uint8Array[]=[],offsets=[0];let length=0;
  const append=(part:string|Uint8Array)=>{const bytes=typeof part==='string'?encoder.encode(part):part;parts.push(bytes);length+=bytes.length;};
  const object=(id:number,body:string)=>{offsets[id]=length;append(`${id} 0 obj\n${body}\nendobj\n`);};
  append('%PDF-1.4\n% Vedik Milan report\n');
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
  pages.forEach((page,i)=>{
    const id=3+i*3;
    object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Report ${id+2} 0 R >> >> /Contents ${id+1} 0 R >>`);
    const content='q\n595.28 0 0 841.89 0 0 cm\n/Report Do\nQ\n';
    object(id+1,`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
    offsets[id+2]=length;
    append(`${id+2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`);
    append(page.bytes);append('\nendstream\nendobj\n');
  });
  const xref=length;append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for(let i=1;i<offsets.length;i++)append(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const output=new Uint8Array(length);let position=0;for(const part of parts){output.set(part,position);position+=part.length;}return output;
}
