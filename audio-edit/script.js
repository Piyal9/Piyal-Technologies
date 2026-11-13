"use strict";
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const ic=d=>'<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="'+d+'"/></svg>';
const PLAY="M8 5v14l11-7z",PAUSE="M6 19h4V5H6v14zm8-14v14h4V5h-4z";
const FORMATS=[
 {id:"wav",label:"WAV (lossless)",ext:"wav",hint:"Uncompressed 16-bit audio. Largest files, perfect quality."},
 {id:"mp3",label:"MP3",ext:"mp3",hint:"Compressed and compatible with almost everything."},
 {id:"webm",label:"WebM (Opus)",ext:"webm",mime:"audio/webm;codecs=opus",hint:"Encoded by your browser in real time, so it takes as long as the clip."},
 {id:"ogg",label:"OGG (Opus)",ext:"ogg",mime:"audio/ogg;codecs=opus",hint:"Encoded by your browser in real time, so it takes as long as the clip."},
 {id:"m4a",label:"M4A (AAC)",ext:"m4a",mime:"audio/mp4",hint:"Encoded by your browser in real time, so it takes as long as the clip."}
];
const MP3_RATES=[8000,11025,12000,16000,22050,24000,32000,44100,48000];
const S={buf:null,start:0,end:0,head:0,playing:false,loop:false,src:null,t0:0,off:0,peaks:null};
let ctx=null,busy=false,raf=0,MIN=0.01;
const el={};["drop","editor","wave","cv","scL","scR","reg","hl","hr","ph","play","loop","cur","tS","tE","tL","name","fmt","kbps","kbw","hint","exp","prog","pbar","fname","meta","newBtn","file","pick","wc","toast"].forEach(k=>el[k]=$(k));

function ensureCtx(){ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();return ctx}
let tt;function toast(m){el.toast.textContent=m;el.toast.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>el.toast.classList.remove("on"),4500)}
function fmt(t){const ms=Math.round(Math.max(0,t)*1000),m=Math.floor(ms/60000);return m+":"+((ms%60000)/1000).toFixed(3).padStart(6,"0")}
function parse(v){v=v.trim();if(!v)return NaN;const p=v.split(":");if(p.length>3)return NaN;let t=0;for(const x of p){const s=x.trim();if(!/^(\d+(\.\d*)?|\.\d+)$/.test(s))return NaN;t=t*60+parseFloat(s)}return t}

/* ---------- formats ---------- */
const supported=FORMATS.filter(f=>!f.mime||(window.MediaRecorder&&MediaRecorder.isTypeSupported(f.mime)));
el.fmt.innerHTML=supported.map(f=>'<option value="'+f.id+'">'+f.label+'</option>').join("");
function fmtChanged(){const f=supported.find(x=>x.id===el.fmt.value);el.hint.textContent=f.hint;el.kbw.hidden=f.id!=="mp3"}
el.fmt.addEventListener("change",fmtChanged);fmtChanged();

/* ---------- loading ---------- */
async function load(file){
  if(busy||!file)return;
  try{
    ensureCtx();hardStop();
    const ab=await file.arrayBuffer();
    const buf=await ctx.decodeAudioData(ab);
    if(!buf.length)throw new Error("empty");
    S.buf=buf;S.start=0;S.end=buf.duration;S.head=0;MIN=Math.min(0.01,buf.duration/2);
    computePeaks();
    el.fname.textContent=file.name;
    const ch=buf.numberOfChannels;
    el.meta.textContent=fmt(buf.duration)+" long, "+(buf.sampleRate/1000)+" kHz, "+(ch===1?"mono":ch===2?"stereo":ch+" channels")+", "+(file.size/1048576).toFixed(2)+" MB";
    el.name.value=file.name.replace(/\.[^.]+$/,"")+"-trimmed";
    el.drop.hidden=true;el.editor.hidden=false;el.newBtn.hidden=false;
    ui();
  }catch(e){console.error(e);toast("This file couldn’t be decoded. Try an MP3, WAV, M4A or OGG file.")}
}
function computePeaks(){
  const n=S.buf.length,bins=4000,chs=[];
  for(let c=0;c<S.buf.numberOfChannels;c++)chs.push(S.buf.getChannelData(c));
  const pk=new Float32Array(bins);let mx=0;
  for(let b=0;b<bins;b++){
    const s=Math.floor(b*n/bins),e=Math.max(s+1,Math.floor((b+1)*n/bins)),st=Math.max(1,Math.floor((e-s)/256));let m=0;
    for(const d of chs)for(let i=s;i<e&&i<n;i+=st){const v=Math.abs(d[i]);if(v>m)m=v}
    pk[b]=m;if(m>mx)mx=m;
  }
  if(mx>0)for(let b=0;b<bins;b++)pk[b]/=mx;
  S.peaks=pk;
}

/* ---------- drawing ---------- */
function draw(){
  if(!S.peaks||el.editor.hidden)return;
  const dpr=window.devicePixelRatio||1,w=Math.floor(el.wave.clientWidth*dpr),h=Math.floor(el.wave.clientHeight*dpr);
  if(!w||!h)return;
  const cv=el.cv;if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
  const cs=getComputedStyle(document.documentElement),pri=cs.getPropertyValue("--pri").trim(),wv=cs.getPropertyValue("--wave").trim(),mut=cs.getPropertyValue("--mut").trim(),ln=cs.getPropertyValue("--line").trim();
  const x=cv.getContext("2d"),d=S.buf.duration;x.clearRect(0,0,w,h);
  const rh=22*dpr,mid=rh+(h-rh)/2,amp=(h-rh)/2*0.9;
  const pps=el.wave.clientWidth/d,steps=[0.05,0.1,0.25,0.5,1,2,5,10,15,30,60,120,300,600,1800,3600];
  const step=steps.find(s=>s*pps>=80)||3600;
  x.font=(11*dpr)+"px Roboto,sans-serif";x.textBaseline="middle";x.lineWidth=dpr;
  for(let i=0;i*step<=d+1e-9;i++){
    const t=Math.round(i*step*1000)/1000,px=Math.round(t/d*w)+.5;
    x.strokeStyle=ln;x.beginPath();x.moveTo(px,rh-6*dpr);x.lineTo(px,rh);x.stroke();
    const m=Math.floor(t/60),s=t-m*60;
    const lab=m+":"+(step<1?s.toFixed(step<0.1?2:1).padStart(step<0.1?5:4,"0"):String(Math.round(s)).padStart(2,"0"));
    x.fillStyle=mut;x.textAlign=px>w-40*dpr?"right":"left";x.fillText(lab,px+(x.textAlign==="left"?4:-4)*dpr,rh/2);
  }
  const bins=S.peaks.length,stp=Math.max(1,Math.round(3*dpr)),bw=Math.max(1,Math.round(2*dpr));
  const sx=S.start/d*w,ex=S.end/d*w;
  for(let px=0;px<w;px+=stp){
    const b0=Math.floor(px/w*bins),b1=Math.max(b0+1,Math.floor((px+stp)/w*bins));let p=0;
    for(let b=b0;b<b1&&b<bins;b++)if(S.peaks[b]>p)p=S.peaks[b];
    const bh=Math.max(dpr,p*amp);
    x.fillStyle=(px+bw>sx&&px<ex)?pri:wv;x.fillRect(px,mid-bh,bw,bh*2);
  }
}
new ResizeObserver(draw).observe(el.wave);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",draw);

/* ---------- selection + UI ---------- */
function setSel(s,e){const d=S.buf.duration;S.start=clamp(s,0,d);S.end=clamp(e,0,d);S.head=clamp(S.head,S.start,S.end);ui()}
function ui(){
  const d=S.buf.duration,pc=t=>(t/d*100)+"%";
  el.hl.style.left=pc(S.start);el.hr.style.left=pc(S.end);
  el.reg.style.left=pc(S.start);el.reg.style.width=((S.end-S.start)/d*100)+"%";
  el.scL.style.width=pc(S.start);el.scR.style.left=pc(S.end);el.scR.style.width=(100-S.end/d*100)+"%";
  el.tS.value=fmt(S.start);el.tE.value=fmt(S.end);el.tL.value=fmt(S.end-S.start);
  for(const [h,v,mn,mx] of [[el.hl,S.start,0,S.end],[el.hr,S.end,S.start,d]]){h.setAttribute("aria-valuemin",mn.toFixed(3));h.setAttribute("aria-valuemax",mx.toFixed(3));h.setAttribute("aria-valuenow",v.toFixed(3));h.setAttribute("aria-valuetext",fmt(v))}
  el.play.innerHTML=ic(S.playing?PAUSE:PLAY);el.play.setAttribute("aria-label",S.playing?"Pause":"Play selection");
  tick();draw();
}
function tick(){const p=pos();el.ph.style.left=(p/S.buf.duration*100)+"%";el.cur.textContent=fmt(p)}

/* ---------- playback ---------- */
function pos(){
  if(!S.playing)return S.head;
  let p=S.off+(ctx.currentTime-S.t0);
  if(S.loop&&p>=S.end)p=S.start+((p-S.start)%(S.end-S.start));
  return clamp(p,S.start,S.end);
}
function play(){
  ensureCtx();ctx.resume();
  if(S.head<S.start||S.head>=S.end-0.005)S.head=S.start;
  const src=ctx.createBufferSource();src.buffer=S.buf;src.connect(ctx.destination);
  if(S.loop){src.loop=true;src.loopStart=S.start;src.loopEnd=S.end;src.start(0,S.head)}
  else src.start(0,S.head,S.end-S.head);
  S.src=src;S.off=S.head;S.t0=ctx.currentTime;S.playing=true;
  src.onended=()=>{if(S.src===src){S.src=null;S.playing=false;S.head=S.start;ui()}};
  cancelAnimationFrame(raf);const loop=()=>{tick();if(S.playing)raf=requestAnimationFrame(loop)};loop();
  el.play.innerHTML=ic(PAUSE);el.play.setAttribute("aria-label","Pause");
}
function hardStop(){if(S.src){const s=S.src;S.src=null;S.playing=false;try{s.stop()}catch(e){}s.disconnect()}}
function pause(){if(!S.playing)return;S.head=pos();hardStop();ui()}
function toggle(){if(!S.buf||busy)return;S.playing?pause():play()}
el.play.addEventListener("click",toggle);
el.loop.addEventListener("click",()=>{
  S.loop=!S.loop;el.loop.setAttribute("aria-pressed",S.loop);
  if(S.playing){S.head=pos();hardStop();play()}
});
document.addEventListener("keydown",e=>{
  if(e.code!=="Space"||!S.buf||el.editor.hidden)return;
  const t=e.target.tagName;if(t==="INPUT"||t==="SELECT"||t==="BUTTON"||t==="TEXTAREA")return;
  e.preventDefault();toggle();
});

/* ---------- dragging ---------- */
function drag(node,kind){
  node.addEventListener("pointerdown",ev=>{
    if(!S.buf||(ev.button&&ev.button>0))return;
    ev.preventDefault();ev.stopPropagation();
    const was=S.playing;if(was)pause();
    node.setPointerCapture(ev.pointerId);
    const r=el.wave.getBoundingClientRect(),d=S.buf.duration,t0=clamp((ev.clientX-r.left)/r.width,0,1)*d,s0=S.start,e0=S.end;let moved=false;
    const mv=e=>{
      const t=clamp((e.clientX-r.left)/r.width,0,1)*d;
      if(Math.abs(e.clientX-ev.clientX)>3)moved=true;
      if(kind==="l")setSel(Math.min(t,S.end-MIN),S.end);
      else if(kind==="r")setSel(S.start,Math.max(t,S.start+MIN));
      else if(moved){const len=e0-s0,s=clamp(s0+(t-t0),0,d-len);setSel(s,s+len)}
    };
    const up=()=>{
      node.removeEventListener("pointermove",mv);node.removeEventListener("pointerup",up);node.removeEventListener("pointercancel",up);
      if(kind==="m"&&!moved){S.head=clamp(t0,S.start,S.end);ui();if(was)play()}
    };
    node.addEventListener("pointermove",mv);node.addEventListener("pointerup",up);node.addEventListener("pointercancel",up);
  });
}
drag(el.hl,"l");drag(el.hr,"r");drag(el.reg,"m");
el.cv.addEventListener("pointerdown",ev=>{
  if(!S.buf)return;const r=el.wave.getBoundingClientRect(),was=S.playing;if(was)pause();
  S.head=clamp(clamp((ev.clientX-r.left)/r.width,0,1)*S.buf.duration,S.start,S.end);ui();if(was)play();
});
for(const [h,k] of [[el.hl,"l"],[el.hr,"r"]])h.addEventListener("keydown",e=>{
  if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;
  e.preventDefault();pause();const dt=(e.key==="ArrowLeft"?-1:1)*(e.shiftKey?0.1:0.01);
  if(k==="l")setSel(clamp(S.start+dt,0,S.end-MIN),S.end);else setSel(S.start,clamp(S.end+dt,S.start+MIN,S.buf.duration));
});
function field(inp,kind){
  inp.addEventListener("change",()=>{
    const t=parse(inp.value);pause();
    if(isNaN(t)){toast("Enter a time like 1:23.456 or 83.5");ui();return}
    if(kind==="s")setSel(Math.min(t,S.end-MIN),S.end);else setSel(S.start,Math.max(t,S.start+MIN));
    ui();
  });
  inp.addEventListener("keydown",e=>{if(e.key==="Enter")inp.blur()});
}
field(el.tS,"s");field(el.tE,"e");

/* ---------- file input ---------- */
el.pick.addEventListener("click",()=>el.file.click());
el.newBtn.addEventListener("click",()=>el.file.click());
el.file.addEventListener("change",()=>{const f=el.file.files[0];el.file.value="";load(f)});
addEventListener("dragover",e=>{e.preventDefault();if(!el.drop.hidden)el.drop.classList.add("over")});
addEventListener("dragleave",e=>{if(!e.relatedTarget)el.drop.classList.remove("over")});
addEventListener("drop",e=>{e.preventDefault();el.drop.classList.remove("over");const f=e.dataTransfer&&e.dataTransfer.files[0];if(f)load(f)});

/* ---------- encoders ---------- */
const tickWait=()=>new Promise(r=>setTimeout(r));
function prog(x){el.pbar.style.width=(x*100)+"%"}
async function encWav(chs,sr){
  const n=chs[0].length,c=chs.length,bytes=n*c*2,ab=new ArrayBuffer(44+bytes),v=new DataView(ab);
  const str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  str(0,"RIFF");v.setUint32(4,36+bytes,true);str(8,"WAVE");str(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,c,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*c*2,true);v.setUint16(32,c*2,true);v.setUint16(34,16,true);str(36,"data");v.setUint32(40,bytes,true);
  let o=44;const CH=1<<16;
  for(let a=0;a<n;a+=CH){
    const e=Math.min(n,a+CH);
    for(let i=a;i<e;i++)for(let k=0;k<c;k++){const s=clamp(chs[k][i],-1,1);v.setInt16(o,s<0?s*0x8000:s*0x7FFF,true);o+=2}
    prog(e/n);await tickWait();
  }
  return new Blob([ab],{type:"audio/wav"});
}
async function resample(chs,sr,to){
  const c=chs.length,len=chs[0].length,b=ctx.createBuffer(c,len,sr);
  chs.forEach((d,i)=>b.copyToChannel(d,i));
  const oc=new OfflineAudioContext(c,Math.ceil(len*to/sr),to),s=oc.createBufferSource();
  s.buffer=b;s.connect(oc.destination);s.start();
  const r=await oc.startRendering();return [...Array(c).keys()].map(i=>r.getChannelData(i));
}
async function encMp3(chs,sr,kbps){
  if(!window.lamejs)throw new Error("The MP3 encoder couldn’t load. Check your connection or pick WAV.");
  ensureCtx();chs=chs.slice(0,2);
  if(!MP3_RATES.includes(sr)){chs=await resample(chs,sr,44100);sr=44100}
  const c=chs.length,n=chs[0].length,enc=new lamejs.Mp3Encoder(c,sr,kbps),out=[],B=1152;
  const toI=(f,a,b)=>{const o=new Int16Array(b-a);for(let i=0;i<o.length;i++){const s=clamp(f[a+i],-1,1);o[i]=s<0?s*0x8000:s*0x7FFF}return o};
  let k=0;
  for(let a=0;a<n;a+=B){
    const e=Math.min(n,a+B),l=toI(chs[0],a,e),d=c===2?enc.encodeBuffer(l,toI(chs[1],a,e)):enc.encodeBuffer(l);
    if(d.length)out.push(d);
    if(++k%300===0){prog(a/n);await tickWait()}
  }
  const f=enc.flush();if(f.length)out.push(f);
  return new Blob(out,{type:"audio/mpeg"});
}
async function record(F){
  ensureCtx();await ctx.resume();
  const dest=ctx.createMediaStreamDestination(),rec=new MediaRecorder(dest.stream,{mimeType:F.mime}),chunks=[];
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  const stopped=new Promise(r=>rec.onstop=r),src=ctx.createBufferSource();
  src.buffer=S.buf;src.connect(dest);
  const dur=S.end-S.start,t0=ctx.currentTime,ended=new Promise(r=>src.onended=r);
  const iv=setInterval(()=>prog(Math.min(0.99,(ctx.currentTime-t0)/dur)),100);
  try{
    rec.start();src.start(0,S.start,dur);
    await ended;await new Promise(r=>setTimeout(r,250));rec.stop();await stopped;
  }finally{clearInterval(iv);src.disconnect()}
  return new Blob(chunks,{type:rec.mimeType||F.mime});
}

/* ---------- export ---------- */
function setBusy(b){busy=b;el.exp.disabled=b;el.wc.inert=b;el.prog.hidden=!b;el.newBtn.disabled=b;if(!b)prog(0)}
async function doExport(){
  if(busy||!S.buf)return;
  pause();setBusy(true);
  const F=supported.find(x=>x.id===el.fmt.value);
  try{
    const sr=S.buf.sampleRate,a=Math.round(S.start*sr),b=Math.min(S.buf.length,Math.round(S.end*sr));
    if(b<=a)throw new Error("The selection is empty.");
    let blob;
    if(F.id==="wav"||F.id==="mp3"){
      const chs=[];for(let i=0;i<S.buf.numberOfChannels;i++)chs.push(S.buf.getChannelData(i).subarray(a,b));
      blob=F.id==="wav"?await encWav(chs,sr):await encMp3(chs,sr,+el.kbps.value);
    }else blob=await record(F);
    prog(1);
    const base=(el.name.value.trim().replace(/[\\/:*?"<>|]/g,"_").replace(/\.(wav|mp3|webm|ogg|m4a)$/i,""))||"trimmed",fn=base+"."+F.ext;
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=fn;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    toast("Exported “"+fn+"” ("+(blob.size/1048576).toFixed(2)+" MB)");
  }catch(e){console.error(e);toast("Export failed. "+(e&&e.message?e.message:"Please try again."))}
  finally{setBusy(false)}
}
el.exp.addEventListener("click",doExport);