// Render storyboard key frames at full res to storyboard/*.png and a contact sheet.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:1200}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('file://'+path.resolve('storyboard.html'));await p.waitForFunction('window.READY',null,{timeout:60000});
fs.mkdirSync('storyboard',{recursive:true});
const times=process.argv.slice(2).length?process.argv.slice(2).map(Number):[12.2,30.5,49,69,88.5];
for(const t of times){const data=await p.evaluate(t=>{seek(t);return document.getElementById('big').toDataURL('image/png')},t);
 fs.writeFileSync('storyboard/t'+t.toFixed(1)+'.png',Buffer.from(data.split(',')[1],'base64'));}
await p.screenshot({path:'storyboard/contact-sheet.png',fullPage:true});
console.log('errors:',errs.length?errs:'none');await b.close();})();
