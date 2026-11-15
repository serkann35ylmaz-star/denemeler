// Deterministic frame render: N parallel pages call seek(i/fps), save JPEGs, then ffmpeg encodes + mixes SFX.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const FPS=30, D=90, N=Math.round(FPS*D), WORKERS=4, OUT='out', TMP='out/frames_tmp';
(async()=>{
 fs.mkdirSync(TMP,{recursive:true});
 const b=await chromium.launch();
 const t0=Date.now(); let done=0;
 await Promise.all([...Array(WORKERS).keys()].map(async w=>{
  const p=await b.newPage({viewport:{width:600,height:1000}});
  p.on('pageerror',e=>console.error('pageerror',e.message));
  await p.goto('file://'+path.resolve('index.html'));await p.waitForFunction('window.READY',null,{timeout:60000});
  for(let i=w;i<N;i+=WORKERS){const f=TMP+'/f'+String(i).padStart(5,'0')+'.jpg'; if(fs.existsSync(f)){done++;continue}
   const data=await p.evaluate(i=>{seek(i/30);return document.getElementById('cv').toDataURL('image/jpeg',0.93)},i);
   fs.writeFileSync(f,Buffer.from(data.split(',')[1],'base64')); done++;
   if(done%150===0) console.log(done+'/'+N, ((Date.now()-t0)/1000).toFixed(0)+'s');}
 }));
 await b.close();
 // sound mix
 const sfx=JSON.parse(execFileSync('node',['-e',"global.window=global;global.document={createElement:()=>({getContext:()=>({})})};require('./paper.js');require('./art.js');require('./scenes.js');console.log(JSON.stringify(Scenes.SFX))"]).toString());
 const args=['-y','-framerate','30','-i',TMP+'/f%05d.jpg'];
 sfx.forEach(([t,f])=>args.push('-i','sfx/'+f+'.wav'));
 const fl=sfx.map(([t,f,g],k)=>`[${k+1}:a]adelay=${Math.round(t*1000)}|${Math.round(t*1000)},volume=${g}[a${k}]`).join(';')+';'+sfx.map((_,k)=>`[a${k}]`).join('')+`amix=inputs=${sfx.length}:normalize=0,alimiter=limit=0.9,apad,atrim=0:${D}[aout]`;
 args.push('-filter_complex',fl,'-map','0:v','-map','[aout]','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','160k','-t',String(D),'-movflags','+faststart',OUT+'/final.mp4');
 execFileSync('ffmpeg',args,{stdio:['ignore','ignore','inherit']});
 console.log('done', ((Date.now()-t0)/1000).toFixed(0)+'s');
})();
