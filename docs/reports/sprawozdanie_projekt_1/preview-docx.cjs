const fs=require('node:fs'),path=require('node:path');
const deps=path.join(process.env.TEMP,'ztp-report-tools','node_modules');
const {chromium}=require(path.join(deps,'playwright'));
const sharp=require(path.join(deps,'sharp'));
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1200,height:1100},deviceScaleFactor:1});
  await page.setContent('<html><head><meta charset="utf-8"></head><body style="margin:0;background:#dde5ea"><main id="preview"></main></body></html>');
  await page.addScriptTag({path:path.join(deps,'jszip/dist/jszip.min.js')});
  await page.addScriptTag({path:path.join(deps,'docx-preview/dist/docx-preview.min.js')});
  const b64=fs.readFileSync(path.join(__dirname,'../Sprawozdanie_Projekt_1_CRUD.docx')).toString('base64');
  await page.evaluate(async(b64)=>{
   const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
   await docx.renderAsync(bytes,document.getElementById('preview'),null,{inWrapper:true,ignoreWidth:false,ignoreHeight:false,breakPages:true,useBase64URL:true,ignoreLastRenderedPageBreak:false});
   await document.fonts.ready;
  },b64);
  const pages=page.locator('section.docx');
  const count=await pages.count();
  const summary=[],thumbs=[];
  for(let i=0;i<count;i++){
   const item=pages.nth(i);
   const box=await item.boundingBox();
   const text=await item.innerText();
   summary.push({page:i+1,width:box.width,height:box.height,characters:text.length,start:text.slice(0,130),end:text.slice(-170)});
   const screenshot=await item.screenshot();
   fs.writeFileSync(path.join(__dirname,'assets',`page-${String(i+1).padStart(2,'0')}.png`),screenshot);
   thumbs.push(await sharp(screenshot).resize(260,368,{fit:'contain',background:'white'}).extend({top:20,bottom:5,left:5,right:5,background:'#DCE5EB'}).png().toBuffer());
  }
  const cols=4,tw=270,th=393;
  await sharp({create:{width:cols*tw,height:Math.ceil(count/cols)*th,channels:3,background:'#CBD6DE'}}).composite(thumbs.map((input,i)=>({input,left:i%cols*tw,top:Math.floor(i/cols)*th}))).png().toFile(path.join(__dirname,'assets','contact-sheet.png'));
  fs.writeFileSync(path.join(__dirname,'layout-check.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify({pages:count,summary},null,2));
 } finally { await browser.close(); }
})();
