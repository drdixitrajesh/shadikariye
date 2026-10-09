export const TEST_PHOTO_LIMIT=256*1024;
export function photoDimensions(width:number,height:number,maxEdge:number){const scale=Math.min(1,maxEdge/Math.max(width,height));return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};}
export async function prepareTestPhoto(file:File):Promise<File>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4*1024*1024)throw new Error('JPG, PNG या WebP 4 MB तक चुनें। / Choose JPG, PNG or WebP up to 4 MB.');
  const image=await createImageBitmap(file);
  try{
    const canvas=document.createElement('canvas');const context=canvas.getContext('2d');if(!context)throw new Error('फोटो तैयार नहीं हुई। / Could not prepare photo.');
    for(const edge of [1600,1200,900,650,450,300,150]){
      const dimensions=photoDimensions(image.width,image.height,edge);canvas.width=dimensions.width;canvas.height=dimensions.height;context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.8));
      if(blob&&blob.size<=TEST_PHOTO_LIMIT)return new File([blob],'test-photo.jpg',{type:'image/jpeg'});
    }
    throw new Error('फोटो 256 KiB तक तैयार नहीं हुई। छोटी फोटो चुनें। / Choose a smaller photo; the 256 KiB limit could not be met.');
  }finally{image.close();}
}
