const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const deps=path.join(process.env.TEMP,'ztp-report-tools','node_modules');
const canvas=require(path.join(deps,'@napi-rs/canvas'));
global.DOMMatrix=canvas.DOMMatrix;global.ImageData=canvas.ImageData;global.Path2D=canvas.Path2D;
const sharp=require(path.join(deps,'sharp'));
(async()=>{
 const pdfjs=await import(pathToFileURL(path.join(deps,'pdfjs-dist/legacy/build/pdf.mjs')));
 const pdf=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(path.join(__dirname,'preview.pdf'))),useSystemFonts:true}).promise;
 const summaries=[],thumbs=[];
 for(let i=1;i<=pdf.numPages;i++){
  const page=await pdf.getPage(i);const content=await page.getTextContent();
  const text=content.items.map(t=>t.str).join(' ');
  summaries.push({page:i,characters:text.length,text});
  const vp=page.getViewport({scale:1.15});const out=canvas.createCanvas(Math.ceil(vp.width),Math.ceil(vp.height));
  await page.render({canvasContext:out.getContext('2d'),viewport:vp}).promise;
  const img=out.toBuffer('image/png');
  fs.writeFileSync(path.join(__dirname,'assets',`page-${String(i).padStart(2,'0')}.png`),img);
  const thumb=await sharp(img).resize(260,368,{fit:'contain',background:'white'}).extend({top:20,bottom:5,left:5,right:5,background:'#DCE5EB'}).png().toBuffer();
  thumbs.push(thumb);
 }
 const cols=4,tw=270,th=393;const rows=Math.ceil(thumbs.length/cols);
 await sharp({create:{width:cols*tw,height:rows*th,channels:3,background:'#CBD6DE'}})
  .composite(thumbs.map((input,i)=>({input,left:(i%cols)*tw,top:Math.floor(i/cols)*th}))).png().toFile(path.join(__dirname,'assets','contact-sheet.png'));
 fs.writeFileSync(path.join(__dirname,'pdf-pages.json'),JSON.stringify(summaries,null,2));
 console.log(JSON.stringify({pages:pdf.numPages,summary:summaries.map(p=>({page:p.page,characters:p.characters,start:p.text.slice(0,130),end:p.text.slice(-170)}))},null,2));
})();
