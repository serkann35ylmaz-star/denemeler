// Deterministic render: parallel pages call seek(i/30), write JPEGs, then ffmpeg muxes the narration.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const FPS=30, WORKERS=4, TMP='out/frames_tmp';
const only=process.argv.slice(2).map(Number); // optional: specific times -> PNG previews
(async()=>{
 fs.mkdirSync(TMP,{recursive:true});fs.mkdirSync('out/preview',{recursive:true});
 const b=await chromium.launch();
 const open=async()=>{const p=await b.newPage({viewport:{width:600,height:1000}});p.on('pageerror',e=>console.error('pageerror',e.message));
  await p.goto('http://127.0.0.1:8765/index.html');await p.waitForFunction('window.READY',null,{timeout:60000});return p};
 if(only.length){const p=await open();for(const t of only){const d=await p.evaluate(t=>{seek(t);return document.getElementById('cv').toDataURL('image/jpeg',0.9)},t);
   fs.writeFileSync('out/preview/t'+t.toFixed(1)+'.jpg',Buffer.from(d.split(',')[1],'base64'));}await b.close();return;}
 const D=await (await open()).evaluate(()=>TL.total), N=Math.round(D*FPS); let done=0; const t0=Date.now();
 await Promise.all([...Array(WORKERS).keys()].map(async w=>{const p=await open();
  for(let i=w;i<N;i+=WORKERS){const f=TMP+'/f'+String(i).padStart(5,'0')+'.jpg';if(fs.existsSync(f)){done++;continue}
   const d=await p.evaluate(i=>{seek(i/30);return document.getElementById('cv').toDataURL('image/jpeg',0.93)},i);
   fs.writeFileSync(f,Buffer.from(d.split(',')[1],'base64'));if(++done%240===0)console.log(done+'/'+N,((Date.now()-t0)/1000|0)+'s');}}));
 await b.close();
 const args=['-y','-v','error','-framerate','30','-i',TMP+'/f%05d.jpg'];
 const hasVo=fs.existsSync('out/audio.wav');
 if(hasVo)args.push('-i','out/audio.wav','-map','0:v','-map','1:a','-c:a','aac','-b:a','192k','-af','apad');
 args.push('-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-t',String(D),'-movflags','+faststart','out/yasak-yemin-7.mp4');
 execFileSync('ffmpeg',args,{stdio:'inherit'});console.log('done',N,'frames',((Date.now()-t0)/1000|0)+'s');
})();
