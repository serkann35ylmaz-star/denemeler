'use strict';
// STORM DECK — "Karayel" recovered footage. Deterministic: everything is f(seed, t).
const CONFIG = { duration: 8, fps: 30, W: 1080, H: 1920, seed: 7319 };
const W = CONFIG.W, H = CONFIG.H, D = CONFIG.duration, FPS = CONFIG.fps;
const S = D / 8;                 // story is authored on an 8-unit base clock, scaled to the duration
const TANH = Math.tan(32.5 * Math.PI / 180);
const FOC = (H / 2) / TANH;      // focal length in px
const DEG = Math.PI / 180;

// ---------- deterministic helpers ----------
function hash(i, s = 0) {
  let x = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((s + CONFIG.seed) | 0, 0xc2b2ae35);
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ss = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const eio = x => -(Math.cos(Math.PI * clamp(x)) - 1) / 2;   // easeInOutSine
function vn1(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, s), hash(i + 1, s), u); }
function rot(a, b, ang) { const c = Math.cos(ang), s = Math.sin(ang); return [c * a - s * b, s * a + c * b]; }
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

// ---------- story timeline (base units, 0..8) ----------
const SHOTS = [
  { id: 'A', b0: 0.0, b1: 2.1, camH: 9.0, pitch: 7.0, yaw: 4, rollBias: -2.0, fog: 0.011, shake: 3.5 },
  { id: 'B', b0: 2.1, b1: 3.5, camH: 3.4, pitch: 2.5, yaw: -10, rollBias: 3.0, fog: 0.013, shake: 5.0 },
  { id: 'C', b0: 3.5, b1: 5.6, camH: 4.2, pitch: 3.5, yaw: 6, rollBias: -1.5, fog: 0.012, shake: 4.0 },
  { id: 'D', b0: 5.6, b1: 6.3, camH: 4.5, pitch: 6.0, yaw: 0, rollBias: 4.5, fog: 0.011, shake: 6.0 },
  { id: 'E', b0: 6.3, b1: 8.01, camH: 5.0, pitch: 4.5, yaw: -4, rollBias: -2.0, fog: 0.012, shake: 2.5 },
];
const JOLTS = [[2.1, 14, 0.6], [2.6, 26, 1.0], [3.5, 10, 0.4], [5.5, 42, 1.6], [5.95, 34, 1.3], [6.3, 12, 0.5]];
function shotAt(b) { for (const s of SHOTS) if (b >= s.b0 && b < s.b1) return s; return SHOTS[SHOTS.length - 1]; }

// sonar target depth (m) as a function of base time
function depthAt(b) {
  if (b < 3.55) return 600 * (1 - eio(b / 3.55));
  if (b < 5.9) return 0;
  return 280 * Math.pow(clamp((b - 5.9) / 2.1), 1.3);
}
function echoI(b) { return b < 0 ? 0.6 : (b < 6.4 ? 1 : 1 - ss(6.4, 7.6, b)); }

// ---------- camera ----------
function camState(t, b, shot) {
  const T = 2 * Math.PI;
  let roll = 5 * Math.sin(T * t / 7.3) + 2 * Math.sin(T * t / 3.1 + 1.2) + shot.rollBias;
  let pitch = shot.pitch + 0.8 * Math.sin(T * t / 5.3 + 0.4) + 0.35 * Math.sin(T * t / 2.3 + 2.1);
  const heave = 0.5 * Math.sin(T * t / 6.1) + 0.2 * Math.sin(T * t / 2.7 + 2);
  const oct = (s) => (vn1(t * 0.7, s) - 0.5) + 0.55 * (vn1(t * 1.9, s + 5) - 0.5) + 0.3 * (vn1(t * 4.0, s + 9) - 0.5);
  let sx = oct(101) * shot.shake * 2.2, sy = oct(202) * shot.shake * 2.2, jr = 0;
  for (const [jb, A, R] of JOLTS) {
    const tau = (b - jb) * S; if (tau < 0 || tau > 0.6) continue;
    const e = Math.exp(-6 * tau) * Math.sin(18 * tau);
    sy += A * e; sx += A * 0.45 * e * Math.cos(jb * 7); jr += R * e;
  }
  roll += jr;
  return {
    roll: roll * DEG, pitch: pitch * DEG + sy / FOC, yaw: shot.yaw * DEG - sx / FOC,
    camH: shot.camH + heave, sx, sy, rollNear: (roll * 0.35 + jr * 0.6) * DEG
  };
}
function project(x, y, z, c) {
  let vx = x, vy = y - c.camH, vz = z;
  [vx, vz] = rot(vx, vz, -c.yaw); [vy, vz] = rot(vy, vz, -c.pitch); [vx, vy] = rot(vx, vy, -c.roll);
  if (vz < 0.1) return null;
  return [W / 2 + (vx / vz / TANH) * H / 2, H / 2 - (vy / vz / TANH) * H / 2, vz];
}

// ---------- GL setup ----------
const glc = document.getElementById('gl');
const gl = glc.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

const SCENE_FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uT; uniform vec4 uCam; uniform float uTanH;
uniform float uFog; uniform float uFogBoost; uniform vec2 uWind;
uniform sampler2D uNoise, uSubj, uNear, uTxt;
uniform vec4 uSubjP; uniform vec4 uBump; uniform float uNearFog;
out vec4 o;
const vec3 C_SKY=vec3(.541,.604,.659), C_HOR=vec3(.482,.545,.596), C_FAR=vec3(.435,.502,.553),
 C_MID=vec3(.290,.373,.427), C_TRO=vec3(.173,.243,.290), C_FOAM=vec3(.706,.761,.796), C_FOAMS=vec3(.522,.592,.639);
const vec4 WV[7] = vec4[7](
  vec4( 0.30,-0.95, 74., 1.05), vec4(-0.20,-0.98, 49., 0.75), vec4( 0.62,-0.78, 31., 0.48),
  vec4( 0.05,-1.00, 19., 0.30), vec4( 0.80,-0.60, 12., 0.17), vec4(-0.45,-0.89, 7.4, 0.10), vec4( 0.70,-0.71, 4.6, 0.06));
vec2 r2(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
float nz(vec2 p){ return texture(uNoise,p/256.).g; }
float nz2(vec2 p){ return texture(uNoise,p/256.).b; }
float seaH(vec2 p, float dist){
  float h=0.;
  for(int i=0;i<7;i++){
    vec2 d=normalize(WV[i].xy); float L=WV[i].z, A=WV[i].w;
    float k=6.2832/L, w=sqrt(9.81*k);
    float ph=k*dot(d,p)-w*uT+float(i)*1.7;
    float s=0.5+0.5*sin(ph);
    float fade=clamp(L/(dist*0.018+0.01)-1.,0.,1.);
    h+=A*fade*(2.*s*s-0.75);
  }
  float fc=clamp(1.6-dist/140.,0.,1.);
  h+=(nz(p*6.+vec2(uT*9.,-uT*3.))-.5)*0.9*fc;
  h+=(nz2(p*17.-vec2(-uT*14.,uT*6.))-.5)*0.35*clamp(1.4-dist/60.,0.,1.);
  if(uBump.z>0.){
    float r=length(p-uBump.xy);
    h+=uBump.z*exp(-r*r/38.);
    h+=uBump.z*0.45*exp(-pow(r-uBump.w,2.)/5.)*sin((r-uBump.w)*1.3+1.);
  }
  return h;
}
vec3 skyCol(vec3 rd, bool mottle){
  float y=rd.y;
  vec3 c=mix(C_HOR,C_SKY,smoothstep(-0.02,0.42,y));
  if(mottle){
    vec2 cp=rd.xz/(max(y,0.0)+0.12)*22.;
    float n=nz(cp+vec2(uT*1.6,0.))*0.65+nz(cp*2.3-vec2(uT*2.,0.))*0.35;
    c*=1.+(n-.5)*0.09;
  }
  c=mix(c,C_HOR*1.02,exp(-abs(y)*30.)*0.35);
  return c;
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 p=(gl_FragCoord.xy-0.5*uRes)/(0.5*uRes.y);
  vec3 rd=normalize(vec3(p*uTanH,1.));
  rd.xy=r2(rd.xy,uCam.x); rd.yz=r2(rd.yz,uCam.y); rd.xz=r2(rd.xz,uCam.z);
  vec3 ro=vec3(0.,uCam.w,0.);
  vec3 col; float tSea=1e9; bool hit=false;
  float fogD=uFog*uFogBoost;
  if(rd.y<-0.0005){
    float tm=max((ro.y-5.)/(-rd.y),0.), tx=min((ro.y+5.)/(-rd.y),6000.);
    vec3 pm=ro+rd*tm, px=ro+rd*tx;
    float hm=pm.y-seaH(pm.xz,tm), hx=px.y-seaH(px.xz,tx);
    float tmid=tx;
    if(hx<0.){
      for(int i=0;i<8;i++){
        tmid=mix(tm,tx,hm/(hm-hx));
        vec3 q=ro+rd*tmid; float hq=q.y-seaH(q.xz,tmid);
        if(hq<0.){tx=tmid;hx=hq;}else{tm=tmid;hm=hq;}
      }
    }
    hit=true; tSea=tmid;
    vec3 hp=ro+rd*tmid;
    float e=max(0.06,tmid*0.004);
    float h0=seaH(hp.xz,tmid);
    vec3 n=normalize(vec3(h0-seaH(hp.xz+vec2(e,0.),tmid),e,h0-seaH(hp.xz+vec2(0.,e),tmid)));
    float fres=clamp(0.03+0.97*pow(1.-max(dot(n,-rd),0.),5.),0.,1.)*0.85;
    vec3 refl=skyCol(reflect(rd,n),false);
    float facing=clamp(h0*0.28+0.5,0.,1.);
    vec3 water=mix(C_TRO,C_MID,facing);
    water=mix(water,C_TRO*0.8,clamp(dot(n.xz,-rd.xz)*2.,0.,1.)*0.35);
    col=mix(water,refl,fres);
    // foam
    vec2 wd=normalize(uWind); vec2 q=vec2(dot(hp.xz,wd),dot(hp.xz,vec2(-wd.y,wd.x)));
    float streak=nz(vec2(q.x*0.35-uT*2.2,q.y*2.8))*0.6+nz2(vec2(q.x*0.9-uT*3.,q.y*7.2))*0.4;
    streak=smoothstep(0.58,0.78,streak)*clamp(1.3-tmid/260.,0.,1.);
    float det=texture(uNoise,hp.xz*9./256.).r;
    float crest=smoothstep(0.9,2.0,h0+(det-.5)*0.8);
    float foam=clamp(crest*(0.55+0.6*nz2(hp.xz*20.))+streak*0.55*(0.6+0.6*det),0.,1.);
    if(uBump.z>0.){ float r=length(hp.xz-uBump.xy); foam=max(foam,(exp(-pow(r-uBump.w,2.)/4.)*0.8+exp(-r*r/30.)*0.6)*min(uBump.z,1.)*(0.5+det)); }
    col=mix(col,mix(C_FOAMS,C_FOAM,clamp(n.y*1.3-0.2,0.,1.)),foam);
    float f=1.-exp(-fogD*tmid);
    vec3 fogc=mix(C_FAR,C_HOR,smoothstep(0.55,1.,f));
    col=mix(col,fogc,f);
  } else {
    col=skyCol(rd,true);
  }
  // subject billboard (fogged in-shader by its own distance + spray haze near the water)
  if(uSubjP.z>0.5){
    vec2 px=vec2(uSubjP.w)/uRes;
    vec4 s=texture(uSubj,uv)*0.36+(texture(uSubj,uv+vec2(px.x,0.))+texture(uSubj,uv-vec2(px.x,0.))+texture(uSubj,uv+vec2(0.,px.y))+texture(uSubj,uv-vec2(0.,px.y)))*0.16;
    if(s.a>0.002){
      float tS=uSubjP.x/max(rd.z,0.05);
      float vis=hit?smoothstep(-0.6,0.6,tSea-tS):1.;
      float hy=ro.y+rd.y*tS;
      vec3 sc=s.rgb/s.a;
      float fs=1.-exp(-uSubjP.y*uFogBoost*uSubjP.x);
      sc=mix(sc,mix(C_FAR,C_HOR,0.6),fs);
      float haze=exp(-max(hy,0.)/1.1)*0.45;
      sc=mix(sc,mix(C_FOAMS,C_FOAM,0.35),haze);
      col=mix(col,sc,s.a*vis);
    }
  }
  // near world layer (soft, phone-blurred)
  vec2 pn=vec2(1.1)/uRes;
  vec4 nr=texture(uNear,uv)*0.4+(texture(uNear,uv+vec2(pn.x,pn.y))+texture(uNear,uv-vec2(pn.x,pn.y))+texture(uNear,uv+vec2(pn.x,-pn.y))+texture(uNear,uv-vec2(pn.x,-pn.y)))*0.15;
  if(nr.a>0.002){ vec3 nc=nr.rgb/nr.a; nc=mix(nc,C_HOR*0.92,uNearFog); col=mix(col,nc,nr.a); }
  // text + rain plane (premultiplied)
  vec4 tx=texture(uTxt,uv);
  col=col*(1.-tx.a)+tx.rgb;
  o=vec4(col,1.);
}`;

const LENS_FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uFrame; uniform vec3 uWipe;
uniform sampler2D uScene, uDrops, uNoise;
out vec4 o;
const vec3 C_FOAM=vec3(.706,.761,.796), C_FOAMS=vec3(.522,.592,.639), C_TRO=vec3(.173,.243,.290);
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec4 dr=texture(uDrops,uv);
  vec2 n=(dr.rg-0.5)*2.; float m=dr.b;
  vec2 suv=uv-n*m*vec2(0.026*uRes.y/uRes.x,0.026);
  float lod=m*2.4;
  vec2 r=uv-0.5;
  vec2 ca=r*vec2(1.,uRes.x/uRes.y)*(2.2/uRes.x);
  vec3 col;
  col.r=textureLod(uScene,suv+ca,lod).r;
  col.g=textureLod(uScene,suv,lod).g;
  col.b=textureLod(uScene,suv-ca,lod).b;
  col=mix(col,textureLod(uScene,suv,1.1).rgb,0.38);
  float ln=length(n);
  float rim=smoothstep(0.72,0.98,ln)*smoothstep(0.02,0.25,m);
  col*=1.-0.26*rim;
  col=mix(col,col*0.92+0.025,m*0.6);
  float hl=exp(-(pow(n.x+0.3,2.)+pow(n.y-0.55,2.))/0.01)*m;
  col+=hl*0.22;
  // spray wipe: sheet covers lens, then drains downward in rivulets
  if(uWipe.z>0.5){
    float nn=texture(uNoise,uv*vec2(0.9,1.4)).g;
    float s=uv.y*0.72+(1.-uv.x)*0.28+(nn-.5)*0.18;
    float cover=1.-smoothstep(uWipe.x-0.12,uWipe.x,s);
    float riv=texture(uNoise,vec2(uv.x*0.3,0.3)).g;
    float riv2=texture(uNoise,vec2(uv.x*0.9,0.6)).b;
    float yTop=1.-uv.y;
    float cleared=smoothstep(0.,0.08,uWipe.y-yTop-(riv-.5)*0.3-(riv2-.5)*0.12);
    cover*=1.-cleared;
    vec3 blur=textureLod(uScene,uv+vec2(0.,0.03)*nn,5.).rgb;
    float fine=texture(uNoise,uv*vec2(1.3,2.1)+vec2(0.,uWipe.x*0.1)).g*0.75+texture(uNoise,uv*vec2(4.,7.)).b*0.25;
    vec3 sheet=mix(C_FOAMS,C_FOAM,smoothstep(0.3,0.75,fine))*0.9+blur*0.12;
    col=mix(col,sheet,cover*0.93);
  }
  // grade
  float L=dot(col,vec3(.2126,.7152,.0722));
  float mx=max(col.r,max(col.g,col.b)), mn=min(col.r,min(col.g,col.b));
  float orange=0.;
  if(mx-mn>0.015 && mx==col.r){ float h=60.*((col.g-col.b)/(mx-mn)); if(h<0.)h+=360.; orange=smoothstep(0.,6.,h)*(1.-smoothstep(28.,40.,h)); }
  col=mix(vec3(L),col,mix(0.6,1.0,orange));
  float sh=1.-smoothstep(0.04,0.33,L);
  col=mix(col,vec3(L)*vec3(0.80,1.0,1.16)+C_TRO*0.05,sh*0.4);
  col=pow(max(col,vec3(0.)),vec3(1.35));
  col=0.035+col*0.965;
  L=dot(col,vec3(.2126,.7152,.0722));
  if(L>0.5){ float Ln=0.5+0.215*(1.-exp(-(L-0.5)/0.215)); col*=Ln/L; }
  vec2 vq=r*2.; float v=smoothstep(0.45,1.45,length(vq));
  col*=1.-0.18*v;
  float g=hash(gl_FragCoord.xy+uFrame*vec2(17.13,31.71))-0.5;
  float g2=hash(gl_FragCoord.xy*1.37+uFrame*vec2(5.1,9.7))-0.5;
  float amt=mix(0.065,0.035,smoothstep(0.1,0.42,L));
  col+=vec3(g*0.9,g*0.95,g*0.8+g2*0.35)*amt;
  o=vec4(clamp(col,0.,1.),1.);
}`;

function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function program(fs) {
  const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
  return { p, u };
}
const progScene = program(SCENE_FS), progLens = program(LENS_FS);
const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

function mkTex(wrap = gl.CLAMP_TO_EDGE, mip = false) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return t;
}
// noise texture: R = white noise, G/B = tileable fbm value noise (two seeds)
const noiseTex = mkTex(gl.REPEAT);
(function buildNoise() {
  const N = 256, data = new Uint8Array(N * N * 4), rnd = mulberry32(CONFIG.seed);
  const lattice = (period, s) => { const a = new Float32Array(period * period); for (let i = 0; i < a.length; i++) a[i] = hash(i, s * 131 + period); return a; };
  const fbm = (s) => {
    const out = new Float32Array(N * N); let amp = 1, tot = 0;
    for (const per of [8, 16, 32, 64]) {
      const L = lattice(per, s), cs = N / per;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const fx = x / cs, fy = y / cs, ix = Math.floor(fx), iy = Math.floor(fy), ux = fx - ix, uy = fy - iy;
        const sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy);
        const a = L[(iy % per) * per + ix % per], b = L[(iy % per) * per + (ix + 1) % per];
        const c = L[((iy + 1) % per) * per + ix % per], d = L[((iy + 1) % per) * per + (ix + 1) % per];
        out[y * N + x] += amp * lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
      }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  };
  const g = fbm(1), b = fbm(2);
  for (let i = 0; i < N * N; i++) { data[i * 4] = rnd() * 255; data[i * 4 + 1] = g[i] * 255; data[i * 4 + 2] = b[i] * 255; data[i * 4 + 3] = 255; }
  gl.bindTexture(gl.TEXTURE_2D, noiseTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
})();
const subjTex = mkTex(), nearTex = mkTex(), txtTex = mkTex(), dropTex = mkTex();
const sceneTex = mkTex(gl.CLAMP_TO_EDGE, true);
gl.bindTexture(gl.TEXTURE_2D, sceneTex);
gl.texStorage2D(gl.TEXTURE_2D, 7, gl.RGBA8, W, H);
const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const subjC = mkCanvas(W, H), nearCv = mkCanvas(W, H), txtC = mkCanvas(W, H), dropC = mkCanvas(W / 2, H / 2), tmpC = mkCanvas(W, H);
const sctx = subjC.getContext('2d'), nctx = nearCv.getContext('2d'), tctx = txtC.getContext('2d'), dctx = dropC.getContext('2d'), mctx = tmpC.getContext('2d');

// ---------- sprites ----------
const blob = mkCanvas(64, 64); (() => {
  const c = blob.getContext('2d'); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(200,212,219,1)'); g.addColorStop(0.45, 'rgba(190,203,211,0.55)'); g.addColorStop(1, 'rgba(180,194,203,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
})();
const dropSprite = mkCanvas(64, 64); (() => {
  const c = dropSprite.getContext('2d'); const im = c.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const dx = (x + 0.5 - 32) / 31, dy = (y + 0.5 - 32) / 31, r = Math.hypot(dx, dy), k = (y * 64 + x) * 4;
    if (r >= 1) { im.data[k + 3] = 0; continue; }
    const sl = Math.pow(r, 0.8);
    im.data[k] = 128 + 127 * (dx / (r + 1e-6)) * sl; im.data[k + 1] = 128 - 127 * (dy / (r + 1e-6)) * sl;
    im.data[k + 2] = 255 * ss(1.0, 0.8, r); im.data[k + 3] = 255 * ss(1.0, 0.9, r);
  }
  c.putImageData(im, 0, 0);
})();
const grainC = mkCanvas(256, 256); (() => {
  const c = grainC.getContext('2d'); const im = c.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = hash(i, 77); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v > 0.5 ? 140 : 0; im.data[i * 4 + 3] = v > 0.72 || v < 0.2 ? 255 : 0; }
  c.putImageData(im, 0, 0);
})();
let grainPat = null;

// ---------- drawing helpers (Canvas 2D) ----------
function catmull(pts, closed, seg = 6) {
  const out = [], n = pts.length;
  const P = i => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < seg; s++) {
      const u = s / seg, u2 = u * u, u3 = u2 * u;
      out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
      0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3)]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
function pathPts(ctx, pts, close = true) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); if (close) ctx.closePath(); }
function catenary(ctx, x1, y1, x2, y2, sag, steps = 24) {
  const a = 2.2, c0 = Math.cosh(a / 2);
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, s = (Math.cosh(a * (u - 0.5)) - c0) / (1 - c0);
    const x = lerp(x1, x2, u), y = lerp(y1, y2, u) + sag * s;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
}
function rope(ctx, x1, y1, x2, y2, sag, w, col = '#11181a', hl = 0.22) {
  ctx.lineCap = 'round';
  catenary(ctx, x1, y1, x2, y2, sag); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
  ctx.save(); ctx.translate(-w * 0.18, -w * 0.25);
  catenary(ctx, x1, y1, x2, y2, sag); ctx.strokeStyle = rgba('#5d6d76', hl); ctx.lineWidth = Math.max(1, w * 0.28); ctx.stroke(); ctx.restore();
}
function poly(ctx, pts, fill) { pathPts(ctx, pts); ctx.fillStyle = fill; ctx.fill(); }

function drawDeck(ctx, pts, vp, b, seed, puddles) {
  ctx.save(); pathPts(ctx, pts);
  const ys = pts.map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#2a3437'); g.addColorStop(0.35, '#232c2e'); g.addColorStop(1, '#141b1c');
  ctx.fillStyle = g; ctx.fill(); ctx.clip();
  // plate seams converging to the vanishing point
  ctx.lineWidth = 2;
  for (let i = -8; i <= 16; i++) {
    const x = -400 + i * 130;
    ctx.beginPath(); ctx.moveTo(vp[0], vp[1]); ctx.lineTo(x, H + 300);
    ctx.strokeStyle = 'rgba(11,18,18,0.55)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vp[0] + 1, vp[1]); ctx.lineTo(x + 3, H + 300);
    ctx.strokeStyle = 'rgba(93,109,118,0.10)'; ctx.stroke();
  }
  for (let k = 1; k < 9; k++) {
    const y = lerp(y0, y1 + 200, Math.pow(k / 9, 1.6));
    ctx.beginPath(); ctx.moveTo(-300, y); ctx.lineTo(W + 300, y - (vp[1] < y ? 0 : 0)); ctx.strokeStyle = 'rgba(11,18,18,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // anti-slip grain
  if (!grainPat) grainPat = ctx.createPattern(grainC, 'repeat');
  ctx.globalAlpha = 0.10; ctx.fillStyle = grainPat; ctx.fillRect(-300, y0 - 10, W + 600, y1 - y0 + 400); ctx.globalAlpha = 1;
  // puddles: broken reflections of the fog sky
  for (let i = 0; i < puddles.length; i++) {
    const [px, py, pw, ph] = puddles[i];
    for (let k = 0; k < 9; k++) {
      const yy = py + (k - 4) * ph * 0.22 + Math.sin(b * 3 + k + i) * 1.5;
      const ww = pw * (0.4 + 0.6 * hash(k + i * 31, seed)) * (1 - Math.abs(k - 4) / 5.5);
      const xx = px + (hash(k + i * 17, seed + 1) - 0.5) * pw * 0.4 + Math.sin(b * 2.1 + k) * 4;
      const a = 0.10 + 0.16 * hash(k + i * 13, seed + 2);
      const gr = ctx.createLinearGradient(xx - ww / 2, 0, xx + ww / 2, 0);
      gr.addColorStop(0, 'rgba(123,139,152,0)'); gr.addColorStop(0.5, `rgba(123,139,152,${a})`); gr.addColorStop(1, 'rgba(123,139,152,0)');
      ctx.fillStyle = gr; ctx.fillRect(xx - ww / 2, yy, ww, Math.max(2, ph * 0.12));
    }
  }
  // thin sheen streaks
  ctx.strokeStyle = 'rgba(93,109,118,0.16)'; ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const x = hash(i, seed + 5) * W, y = lerp(y0 + 40, y1, hash(i, seed + 6)), l = 40 + 120 * hash(i, seed + 7);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y - l * 0.05); ctx.stroke();
  }
  ctx.restore();
}
// rail between p0 (far) and p1 (near): top tube, mid rail, stanchions; h0/h1 = post height in px at each end
function drawRail(ctx, p0, p1, h0, h1, w0, w1, n = 9, bulwark = true) {
  const P = u => [lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)];
  const Hh = u => lerp(h0, h1, u), Ww = u => lerp(w0, w1, u);
  if (bulwark) {
    const pts = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12, p = P(u); pts.push([p[0], p[1] + Hh(u) * 0.55]); }
    for (let i = 12; i >= 0; i--) { const u = i / 12, p = P(u); pts.push([p[0], p[1] + Hh(u) * 2.6 + 80]); }
    const g = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]); g.addColorStop(0, '#2b363b'); g.addColorStop(1, '#0d1415');
    poly(ctx, pts, g);
    ctx.strokeStyle = 'rgba(93,109,118,0.35)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 12; i++) { const u = i / 12, p = P(u); i ? ctx.lineTo(p[0], p[1] + Hh(u) * 0.55) : ctx.moveTo(p[0], p[1] + Hh(u) * 0.55); } ctx.stroke();
  }
  // stanchions (perspective spacing)
  for (let i = 0; i <= n; i++) {
    const u = Math.pow(i / n, 1.35), p = P(u), hh = Hh(u), ww = Ww(u) * 0.75;
    const g = ctx.createLinearGradient(p[0] - ww, 0, p[0] + ww, 0);
    g.addColorStop(0, '#0b1212'); g.addColorStop(0.35, lerpCol('#3a474e', '#11181a', u)); g.addColorStop(1, '#0b1212');
    ctx.fillStyle = g; ctx.fillRect(p[0] - ww / 2, p[1], ww, hh * 0.6);
  }
  // mid rail + top tube
  for (const [off, k] of [[0.32, 0.6], [0, 1]]) {
    const pts = [];
    for (let i = 0; i <= 16; i++) { const u = i / 16, p = P(u); pts.push([p[0], p[1] + Hh(u) * off - Ww(u) * k / 2]); }
    for (let i = 16; i >= 0; i--) { const u = i / 16, p = P(u); pts.push([p[0], p[1] + Hh(u) * off + Ww(u) * k / 2]); }
    const g = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]); g.addColorStop(0, '#3a474e'); g.addColorStop(1, '#11181a');
    poly(ctx, pts, g);
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) { const u = i / 16, p = P(u); const y = p[1] + Hh(u) * off - Ww(u) * k * 0.38; i ? ctx.lineTo(p[0], y) : ctx.moveTo(p[0], y); }
    ctx.strokeStyle = 'rgba(120,136,146,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
  }
}
function lerpCol(a, b, u) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const r = Math.round(lerp(A >> 16, B >> 16, u)), g = Math.round(lerp((A >> 8) & 255, (B >> 8) & 255, u)), bl = Math.round(lerp(A & 255, B & 255, u));
  return `rgb(${r},${g},${bl})`;
}
// near vertical structure (mast / davit / crane post)
function drawMast(ctx, x0, x1, yTop, yBot, seed, opts = {}) {
  const w = x1 - x0;
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  const lit = opts.litRight !== false;
  g.addColorStop(0, lit ? '#0b1212' : '#2a3539'); g.addColorStop(0.55, '#11181a'); g.addColorStop(0.9, lit ? '#1f292c' : '#0b1212'); g.addColorStop(1, lit ? '#3a474e' : '#0b1212');
  ctx.fillStyle = g; ctx.fillRect(x0, yTop, w, yBot - yTop);
  // brackets / collars
  for (let i = 0; i < 6; i++) {
    const y = lerp(yTop + 80, yBot - 100, hash(i, seed));
    ctx.fillStyle = '#0d1415'; ctx.fillRect(x0 - 6, y, w + (lit ? 26 : 12), 18 + 12 * hash(i, seed + 1));
    ctx.fillStyle = 'rgba(93,109,118,0.35)'; ctx.fillRect(x0 - 6, y, w + (lit ? 26 : 12), 2);
  }
  // cable bundle along the mast
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    ctx.beginPath(); const cx = x1 + 6 + k * 7;
    ctx.moveTo(cx, yTop); for (let y = yTop; y <= yBot; y += 60) ctx.lineTo(cx + Math.sin(y * 0.01 + k) * 3, y);
    ctx.strokeStyle = '#0b1212'; ctx.lineWidth = 5 - k; ctx.stroke();
  }
  // edge highlight
  ctx.fillStyle = 'rgba(120,136,146,0.30)'; ctx.fillRect(lit ? x1 - 3 : x0, yTop, 2, yBot - yTop);
  if (opts.lamp) {
    const [lx, ly] = opts.lamp;
    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 46);
    lg.addColorStop(0, 'rgba(200,210,214,0.55)'); lg.addColorStop(0.2, 'rgba(160,175,182,0.25)'); lg.addColorStop(1, 'rgba(140,155,165,0)');
    ctx.fillStyle = lg; ctx.fillRect(lx - 46, ly - 46, 92, 92);
  }
}
// survival-suited crew member, seen from behind
function drawPerson(ctx, o) {
  const u = o.h;
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.lean || 0);
  const hipY = -0.47 * u, shY = -0.79 * u, headY = -0.895 * u, st = o.stance || 0.1;
  // legs
  for (const sgn of [-1, 1]) {
    const hx = sgn * 0.075 * u, fx = sgn * st * u + (o.legShift || 0) * u * (sgn > 0 ? 1 : 0.3);
    const g = ctx.createLinearGradient(0, hipY, 0, 0); g.addColorStop(0, '#8e3520'); g.addColorStop(0.45, '#6b2a1a'); g.addColorStop(1, '#4d2219');
    ctx.beginPath(); ctx.moveTo(hx - 0.085 * u, hipY); ctx.lineTo(hx + 0.085 * u, hipY);
    ctx.lineTo(fx + 0.07 * u, -0.06 * u); ctx.lineTo(fx - 0.075 * u, -0.06 * u); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(77,34,25,0.6)'; ctx.fillRect(lerp(hx, fx, 0.5) - 0.07 * u, -0.27 * u, 0.14 * u, 0.025 * u); // knee fold
    ctx.fillStyle = '#1a2124'; ctx.beginPath(); ctx.ellipse(fx, -0.035 * u, 0.085 * u, 0.045 * u, 0, 0, Math.PI * 2); ctx.fill();
  }
  // arms (behind torso when reaching forward)
  const arm = (sgn, hand, front) => {
    const sx = sgn * 0.19 * u, sy = shY + 0.04 * u;
    const ex = lerp(sx, hand[0] * u, 0.5) + sgn * 0.05 * u, ey = lerp(sy, hand[1] * u, 0.5) + 0.03 * u;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(ex, ey, hand[0] * u, hand[1] * u);
    ctx.strokeStyle = front ? '#a23d22' : '#7c2f1b'; ctx.lineWidth = 0.105 * u; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx - sgn * 0.01 * u, sy - 0.02 * u); ctx.quadraticCurveTo(ex - sgn * 0.01 * u, ey - 0.03 * u, hand[0] * u, hand[1] * u - 0.02 * u);
    ctx.strokeStyle = 'rgba(196,80,46,0.55)'; ctx.lineWidth = 0.035 * u; ctx.stroke();
    // reflective tape band on the upper arm
    const tx = lerp(sx, ex, 0.55), ty = lerp(sy, ey, 0.55);
    ctx.fillStyle = 'rgba(180,194,203,0.55)'; ctx.save(); ctx.translate(tx, ty); ctx.rotate(Math.atan2(ey - sy, ex - sx) + Math.PI / 2);
    ctx.fillRect(-0.055 * u, -0.011 * u, 0.11 * u, 0.022 * u); ctx.restore();
    ctx.fillStyle = '#1a2124'; ctx.beginPath(); ctx.arc(hand[0] * u, hand[1] * u, 0.03 * u, 0, Math.PI * 2); ctx.fill();
  };
  const hl = o.handL || [-0.3, -0.55], hr = o.handR || [0.3, -0.55];
  if (o.armsBehind) { arm(-1, hl, false); arm(1, hr, false); }
  // torso
  const g = ctx.createLinearGradient(0, shY - 0.04 * u, 0, hipY + 0.05 * u);
  g.addColorStop(0, '#c4502e'); g.addColorStop(0.35, '#a23d22'); g.addColorStop(1, '#7c2f1b');
  ctx.beginPath();
  ctx.moveTo(-0.17 * u, hipY + 0.05 * u);
  ctx.lineTo(-0.225 * u, shY + 0.07 * u); ctx.quadraticCurveTo(-0.23 * u, shY - 0.02 * u, -0.12 * u, shY - 0.03 * u);
  ctx.lineTo(0.12 * u, shY - 0.03 * u); ctx.quadraticCurveTo(0.23 * u, shY - 0.02 * u, 0.225 * u, shY + 0.07 * u);
  ctx.lineTo(0.17 * u, hipY + 0.05 * u); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  const sg = ctx.createLinearGradient(-0.23 * u, 0, 0.23 * u, 0);
  sg.addColorStop(0, 'rgba(77,34,25,0.55)'); sg.addColorStop(0.3, 'rgba(77,34,25,0)'); sg.addColorStop(0.7, 'rgba(77,34,25,0)'); sg.addColorStop(1, 'rgba(77,34,25,0.6)');
  ctx.fillStyle = sg; ctx.fillRect(-0.3 * u, shY - 0.1 * u, 0.6 * u, 0.5 * u);
  ctx.strokeStyle = 'rgba(77,34,25,0.45)'; ctx.lineWidth = 0.012 * u;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-0.12 * u, shY + (0.12 + k * 0.07) * u); ctx.quadraticCurveTo(0, shY + (0.15 + k * 0.07) * u + Math.sin(k + (o.x || 0)) * 0.01 * u, 0.12 * u, shY + (0.11 + k * 0.07) * u); ctx.stroke(); }
  ctx.fillStyle = 'rgba(180,194,203,0.42)'; ctx.fillRect(-0.22 * u, shY + 0.045 * u, 0.44 * u, 0.02 * u); // shoulder tape
  ctx.fillStyle = 'rgba(214,226,232,0.10)'; ctx.fillRect(-0.18 * u, shY - 0.03 * u, 0.2 * u, 0.06 * u);  // wet sheen
  ctx.restore();
  if (!o.armsBehind) { arm(-1, hl, true); arm(1, hr, true); }
  // hood
  const hx = (o.turn || 0) * 0.03 * u;
  const hg = ctx.createRadialGradient(hx - 0.03 * u, headY - 0.08 * u, 0.01 * u, hx, headY, 0.15 * u);
  hg.addColorStop(0, '#c4502e'); hg.addColorStop(0.6, '#a23d22'); hg.addColorStop(1, '#5e2618');
  ctx.beginPath(); ctx.ellipse(hx, headY, 0.104 * u, 0.112 * u, (o.turn || 0) * 0.15, 0, Math.PI * 2); ctx.fillStyle = hg; ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx - 0.03 * u, headY - 0.075 * u, 0.05 * u, 0.025 * u, -0.3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(214,226,232,0.16)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx, headY + 0.1 * u, 0.12 * u, 0.03 * u, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(77,34,25,0.55)'; ctx.fill(); // collar fold
  ctx.restore();
}
function personFogged(ctx, o, fog) {
  if (!fog) { drawPerson(ctx, o); return; }
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, W, H);
  mctx.setTransform(ctx.getTransform()); drawPerson(mctx, o);
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.globalCompositeOperation = 'source-atop'; mctx.fillStyle = rgba('#7b8b98', fog); mctx.fillRect(0, 0, W, H);
  mctx.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(tmpC, 0, 0); ctx.restore();
}
function sprayBlobs(ctx, list, alphaMul = 1) {
  for (const [x, y, r, a] of list) { ctx.globalAlpha = a * alphaMul; ctx.drawImage(blob, x - r, y - r, 2 * r, 2 * r); }
  ctx.globalAlpha = 1;
}

// ---------- the subject: megalodon silhouette in local metres (snout at 0,0; tail +x; up +y) ----------
const BODY = [[0.0, 0.05], [0.2, 0.5], [0.8, 1.05], [1.9, 1.5], [3.5, 1.9], [5.3, 2.1], [6.6, 2.15],
[7.3, 2.9], [7.8, 3.8], [8.2, 4.35], [8.55, 4.4], [8.62, 4.1], [8.5, 3.3], [8.85, 2.3],
[10.5, 1.95], [12.4, 1.45], [14.0, 0.9], [15.2, 0.55], [15.9, 0.5],
[16.5, 1.3], [17.3, 2.8], [17.75, 3.25], [17.85, 3.0], [17.4, 1.6], [17.2, 0.4],
[17.6, -1.1], [17.5, -1.5], [16.9, -1.0], [16.1, -0.45],
[15.0, -0.65], [13.0, -1.2], [11.0, -1.6], [9.0, -1.85], [7.2, -1.95],
[6.6, -2.1], [7.4, -3.5], [7.6, -3.75], [7.2, -3.6], [5.9, -2.3], [5.0, -1.9],
[4.2, -1.55], [3.5, -1.2], [3.3, -0.95], [2.4, -0.6], [1.3, -0.4], [0.45, -0.2]];
const UPPER_JAW = [[0.45, -0.2], [1.3, -0.4], [2.4, -0.6], [3.3, -0.95]];
const LOWER_JAW = [[0.45, -0.2], [1.3, -0.4], [2.4, -0.6], [3.3, -0.95], [3.5, -1.25], [2.3, -1.35], [1.1, -1.0], [0.45, -0.5]];
const HINGE = [3.3, -0.95];
const BODY_S = catmull(BODY, true, 5).map((p, k) => { const n = (vn1(k * 0.45, 900) - 0.5) * 0.14 + (vn1(k * 1.7, 901) - 0.5) * 0.05; return [p[0], p[1] + n]; });

function subjectState(b) {
  if (b >= 3.5 && b < 5.6) {
    const u = (b - 3.5) / 2.1, r = eio((b - 3.95) / 1.45);
    return {
      Zs: lerp(50, 21, eio(u)), px: lerp(3.0, 1.2, eio(u)), py: lerp(-2.25, -0.4, r), theta: 50 * r * DEG,
      jaw: 19 * eio((b - 4.45) / 0.9) * DEG, fog: lerp(0.026, 0.014, eio(u)), blur: lerp(2.6, 1.6, u),
      spray: { from: 3.95, to: 5.6 }, rise: r, sheen: r
    };
  }
  if (b >= 5.6 && b < 6.3) {
    const u = (b - 5.6) / 0.7;
    return { Zs: 17, px: lerp(4.5, -2.5, u), py: -0.45, theta: -3 * DEG, jaw: 10 * DEG, fog: 0.008, blur: 1.1, spray: { from: 5.3, to: 6.3 }, rise: 1, sheen: 1 };
  }
  if (b >= 6.3 && b < 7.4) {
    const u = (b - 6.3) / 1.1;
    return { Zs: 72, px: lerp(-6, -11, u), py: lerp(-2.3, -6.2, eio(u)), theta: -9 * DEG, jaw: 0, fog: 0.02, blur: 2.6, spray: { from: 6.0, to: 6.9 }, rise: 0, sheen: 0 };
  }
  return null;
}
function subjLocalToWorld(s, lx, ly, b) {
  if (lx > 9) ly += 0.35 * Math.sin(2 * Math.PI * 0.55 * b - lx * 0.35) * Math.pow((lx - 9) / 9, 1.5);
  const [rx, ry] = rot(lx - 10, ly, -s.theta);
  return [s.px + rx, s.py + ry, s.Zs];
}
function drawSubject(ctx, s, cam, b) {
  const P = (lx, ly) => { const w = subjLocalToWorld(s, lx, ly, b); return project(w[0], w[1], w[2], cam); };
  const pxm = FOC / s.Zs; // px per metre at subject distance
  const body = BODY_S.map(p => P(p[0], p[1]));
  if (body.some(p => !p)) return;
  // mouth interior + lower jaw (rotated about hinge)
  const jawPt = (p) => { const [x, y] = rot(p[0] - HINGE[0], p[1] - HINGE[1], s.jaw); return [HINGE[0] + x, HINGE[1] + y]; };
  const lowLocal = LOWER_JAW.map(jawPt);
  if (s.jaw > 0.01) {
    const mouth = UPPER_JAW.map(p => P(p[0], p[1] - 0.02)).concat(lowLocal.slice(0, 4).reverse().map(p => P(p[0], p[1])));
    poly(ctx, mouth, '#2b161a');
    // teeth (pale, small: 18 cm)
    ctx.fillStyle = '#9c938a';
    for (let i = 0; i < 9; i++) {
      const u = 0.08 + i * 0.1, a = lerpPts(UPPER_JAW, u), l = 0.26 * (1 - u * 0.5);
      const p1 = P(a[0] - 0.08, a[1]), p2 = P(a[0] + 0.08, a[1]), p3 = P(a[0], a[1] - l);
      poly(ctx, [p1, p2, p3], '#9c938a');
      const lo = jawPt(lerpPts(UPPER_JAW, u + 0.03)), up = jawPt([lo[0], lo[1] + 0.22 * (1 - u * 0.5)]);
      poly(ctx, [P(lo[0] - 0.07, lo[1]), P(lo[0] + 0.07, lo[1]), P(up[0], up[1])], '#8d847c');
    }
  }
  const low = lowLocal.map(p => P(p[0], p[1]));
  // body fill
  ctx.save();
  pathPts(ctx, body); ctx.fillStyle = '#70343e'; ctx.fill();
  pathPts(ctx, low); ctx.fill();
  pathPts(ctx, body); ctx.clip();
  const gt = P(6, 2.4), gb = P(6, -2.3);
  const g = ctx.createLinearGradient(gt[0], gt[1], gb[0], gb[1]);
  g.addColorStop(0, 'rgba(112,92,98,0.22)'); g.addColorStop(0.3, 'rgba(122,59,69,0)'); g.addColorStop(0.6, 'rgba(60,24,32,0.4)'); g.addColorStop(1, 'rgba(30,12,16,0.7)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // mottled skin
  for (let i = 0; i < 70; i++) {
    const lx = hash(i, 51) * 16, ly = (hash(i, 52) - 0.5) * 3.5, q = P(lx, ly), r = (0.15 + 0.4 * hash(i, 53)) * pxm;
    ctx.fillStyle = hash(i, 54) > 0.5 ? 'rgba(40,16,22,0.16)' : 'rgba(160,130,135,0.10)';
    ctx.beginPath(); ctx.ellipse(q[0], q[1], r * 1.8, r, s.theta, 0, Math.PI * 2); ctx.fill();
  }
  // gill slits
  ctx.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const x = 4.0 + k * 0.36, a = P(x, 0.75), c = P(x + 0.28, -0.1), e = P(x + 0.05, -1.05);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]);
    ctx.strokeStyle = 'rgba(42,16,22,0.6)'; ctx.lineWidth = Math.max(1.2, 0.11 * pxm); ctx.stroke();
    ctx.save(); ctx.translate(0.05 * pxm, 0); ctx.strokeStyle = 'rgba(160,125,130,0.18)'; ctx.lineWidth = Math.max(1, 0.05 * pxm); ctx.stroke(); ctx.restore();
  }
  // eye
  const ey = P(1.55, 0.55); ctx.fillStyle = 'rgba(20,10,12,0.85)'; ctx.beginPath(); ctx.ellipse(ey[0], ey[1], 0.13 * pxm, 0.1 * pxm, 0, 0, Math.PI * 2); ctx.fill();
  // water sheeting off the back
  if (s.sheen > 0) {
    ctx.lineWidth = Math.max(1, 0.06 * pxm);
    for (let i = 0; i < 26; i++) {
      const lx = 0.4 + hash(i, 61) * 9.5, ph = ((b * 1.6 + hash(i, 62) * 3) % 3) / 3;
      const top = 2.0 - Math.abs(lx - 6) * 0.15, y0 = top - ph * 3.2, y1 = y0 - 0.6 - 0.8 * hash(i, 63);
      const a = P(lx, y0), c = P(lx + 0.05, y1);
      ctx.strokeStyle = `rgba(200,212,219,${0.22 * s.sheen * (1 - ph)})`;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
    }
  }
  ctx.restore();
}
function lerpPts(pts, u) { const f = clamp(u) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), k = f - i; return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)]; }
// waterline crossings (world x range where the body meets the sea)
function waterRange(s, b) {
  let mn = 1e9, mx = -1e9, front = null;
  for (const p of BODY_S) { const w = subjLocalToWorld(s, p[0], p[1], b); if (Math.abs(w[1]) < 0.45) { mn = Math.min(mn, w[0]); mx = Math.max(mx, w[0]); } }
  return mn < mx ? [mn, mx] : null;
}
function drawSpray(ctx, s, cam, b) {
  const wr = waterRange(s, b); if (!wr) return;
  const list = [];
  const [x0, x1] = wr, span = x1 - x0;
  // breaching curtain
  const N = 1300;
  for (let i = 0; i < N; i++) {
    const bl = s.spray.from + hash(i, 71) * (s.spray.to - s.spray.from);
    const life = 1.0 + 0.5 * hash(i, 72), tau = (b - bl) * S;
    if (tau < 0 || tau > life) continue;
    const front = hash(i, 73) < 0.55;
    const xe = front ? x0 + (hash(i, 74) - 0.3) * 3.5 : x0 + hash(i, 74) * span;
    const v0 = (front ? 4 : 2) + 8 * Math.pow(hash(i, 75), 2) * (0.4 + 0.6 * s.rise + 0.3);
    const y = v0 * tau - 4.9 * tau * tau; if (y < -0.3) continue;
    const x = xe + (hash(i, 76) - 0.5) * 2.5 * tau + 1.4 * tau * tau;
    const z = s.Zs - 1.5 + 3 * hash(i, 77);
    const q = project(x, Math.max(y, 0), z, cam); if (!q) continue;
    const r = (0.22 + 0.55 * hash(i, 78) + 0.6 * tau) * FOC / z;
    const a = 0.26 * (1 - tau / life) * (y > 0 ? 1 : 1 + y / 0.3);
    list.push([q[0], q[1], r, a]);
  }
  // churning band at the waterline
  for (let i = 0; i < 320; i++) {
    const life = 0.55 + 0.3 * hash(i, 81), ph = hash(i, 82) * life, cyc = Math.floor((b * S + ph) / life), tau = (b * S + ph) - cyc * life;
    const xe = x0 - 1 + hash(i * 131 + cyc, 83) * (span + 2), y = (2.2 + 2.5 * hash(i * 7 + cyc, 84)) * tau - 4.9 * tau * tau;
    if (y < -0.1) continue;
    const q = project(xe + tau * 1.2, Math.max(0, y), s.Zs - 0.8 + 1.6 * hash(i, 85), cam); if (!q) continue;
    list.push([q[0], q[1], (0.35 + 0.5 * hash(i, 86)) * FOC / s.Zs, 0.24 * (1 - tau / life)]);
  }
  sprayBlobs(ctx, list);
}

// ---------- text ----------
const MONO = '"JetBrains Mono"', COND = 'Oswald';
function setShadow(ctx, on) { ctx.shadowColor = on ? 'rgba(5,10,10,0.7)' : 'transparent'; ctx.shadowBlur = on ? 3 : 0; ctx.shadowOffsetX = on ? 1 : 0; ctx.shadowOffsetY = on ? 1 : 0; }
function backing(ctx, cx, cy, rx, ry, a) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(rx / 100, ry / 100);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 100); g.addColorStop(0, `rgba(11,18,18,${a})`); g.addColorStop(1, 'rgba(11,18,18,0)');
  ctx.fillStyle = g; ctx.fillRect(-100, -100, 200, 200); ctx.restore();
}
function readoutAlpha(t, tin, tout) {
  if (t < tin) return 0;
  const f = Math.floor((t - tin) * FPS);
  if (t <= tout) return f < 4 ? [0, 1, 0.4, 1][f] : 1;
  const fo = (t - tout) * FPS; return fo >= 6 ? 0 : 1 - fo / 6;
}
function drawReadout(ctx, o, t) {
  const a = readoutAlpha(t, o.tin * S, o.tout * S); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `500 ${o.size || 60}px ${MONO}`; const vw = ctx.measureText(o.value).width;
  ctx.font = `500 23px ${MONO}`; ctx.letterSpacing = '1.8px'; const lw = ctx.measureText(o.label).width;
  const bw = Math.max(vw, lw), bx = o.align === 'right' ? o.x - bw / 2 : o.x + bw / 2;
  backing(ctx, bx, o.y - (o.size || 60) * 0.55, bw * 0.75 + 60, (o.size || 60) * 1.4, 0.42);
  setShadow(ctx, true);
  ctx.fillStyle = 'rgba(230,236,239,0.72)'; ctx.fillText(o.label, o.x, o.y - (o.size || 60) - 14);
  ctx.letterSpacing = '0px'; ctx.font = `500 ${o.size || 60}px ${MONO}`; ctx.fillStyle = 'rgba(230,236,239,0.86)';
  ctx.fillText(o.value, o.x, o.y);
  ctx.restore();
  return { vw, a };
}
function drawTitle(ctx, lines, x, y, size, tin, tout, t, cam, align = 'left', lh = 1.08) {
  tin *= S; tout *= S;
  if (t < tin || t > tout + 0.4) return;
  const fin = 0.7, a = t < tin + fin ? eio((t - tin) / fin) : (t > tout ? 1 - (t - tout) / 0.4 : 1);
  const drift = (1 - clamp((t - tin) / 1.2)) * 4 * (cam.sx > 0 ? -1 : 1);
  ctx.save(); ctx.globalAlpha = clamp(a) * 0.9; ctx.font = `600 ${size}px ${COND}`; ctx.letterSpacing = `${(size * 0.04).toFixed(1)}px`; ctx.textAlign = align;
  let mw = 0; for (const l of lines) mw = Math.max(mw, ctx.measureText(l).width);
  if (mw > W - 128) { size = Math.floor(size * (W - 128) / mw); ctx.font = `600 ${size}px ${COND}`; ctx.letterSpacing = `${(size * 0.04).toFixed(1)}px`; mw = 0; for (const l of lines) mw = Math.max(mw, ctx.measureText(l).width); }
  const bx = align === 'left' ? x + mw / 2 : (align === 'right' ? x - mw / 2 : x);
  backing(ctx, bx + drift, y + (lines.length - 1) * size * lh / 2 - size * 0.35, mw * 0.7 + 80, size * (lines.length * 0.75 + 0.9), 0.4);
  setShadow(ctx, true); ctx.fillStyle = 'rgb(223,230,234)';
  lines.forEach((l, i) => ctx.fillText(l, x + drift, y + i * size * lh));
  ctx.restore();
}
function drawOSD(ctx, t) {
  const fr = Math.round(t * FPS);
  ctx.save(); ctx.font = `500 28px ${MONO}`; ctx.textBaseline = 'top'; setShadow(ctx, true);
  ctx.fillStyle = 'rgba(230,236,239,0.8)';
  const sec = 3 * 3600 + 11 * 60 + 53 + Math.floor(t), hh = Math.floor(sec / 3600), mm = Math.floor(sec / 60) % 60, s2 = sec % 60;
  const p2 = n => String(n).padStart(2, '0');
  if ((t % 1) < 0.5) { ctx.fillStyle = '#b8463c'; ctx.beginPath(); ctx.arc(78, 82, 10, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(230,236,239,0.8)';
  ctx.fillText('REC', 98, 68); ctx.fillText(`${p2(hh)}:${p2(mm)}:${p2(s2)}`, 176, 68);
  ctx.textAlign = 'right'; ctx.fillText(`F ${String(fr).padStart(5, '0')}`, W - 64, 68);
  // battery glyph
  ctx.strokeStyle = 'rgba(230,236,239,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(W - 300, 72, 44, 22); ctx.fillRect(W - 256, 78, 4, 10);
  for (let i = 0; i < 3; i++) ctx.fillRect(W - 296 + i * 13, 76, 10, 14);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillText('KARAYEL', 64, H - 64);
  ctx.textAlign = 'right'; ctx.fillText('KUZEY PASİFİK', W - 64, H - 64);
  ctx.restore();
}
function drawSonar(ctx, x, y, w, h, b) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fillStyle = 'rgba(11,18,18,0.75)'; ctx.fill();
  ctx.strokeStyle = '#5d6d76'; ctx.lineWidth = 1; ctx.stroke(); ctx.clip();
  const px0 = x + 16, py0 = y + 50, pw = w - 110, ph = h - 66;
  ctx.font = `500 24px ${MONO}`; ctx.fillStyle = 'rgba(159,208,138,0.85)'; ctx.fillText('SONAR', x + 16, y + 34);
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(159,208,138,0.7)';
  for (const d of [0, 300, 600]) { const yy = py0 + ph * d / 650; ctx.fillText(d === 600 ? '600 M' : String(d), x + w - 12, yy + 8); ctx.fillRect(px0 + pw + 2, yy, 8, 1); }
  // grid
  ctx.fillStyle = 'rgba(159,208,138,0.10)'; for (let k = 1; k < 6; k++) ctx.fillRect(px0, py0 + ph * k / 6, pw, 1);
  ctx.shadowColor = '#9fd08a'; ctx.shadowBlur = 8;
  const win = 4.0, step = 3;
  ctx.beginPath(); let first = true;
  for (let cx = 0; cx <= pw; cx += step) {
    const tau = b - (pw - cx) / pw * win, d = 600 + 14 * (vn1(tau * 0.9, 300) - 0.5) + 6 * (vn1(tau * 3.1, 301) - 0.5);
    const yy = py0 + ph * d / 650; first ? ctx.moveTo(px0 + cx, yy) : ctx.lineTo(px0 + cx, yy); first = false;
  }
  ctx.strokeStyle = 'rgba(159,208,138,0.8)'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.shadowBlur = 0;
  for (let cx = 0; cx <= pw; cx += step) {
    const tau = b - (pw - cx) / pw * win; const col = Math.floor(tau * 30);
    for (let k = 0; k < 3; k++) { const yy = py0 + 4 + hash(col * 5 + k, 310) * ph * 0.12; ctx.fillStyle = `rgba(159,208,138,${0.15 + 0.25 * hash(col * 5 + k, 311)})`; ctx.fillRect(px0 + cx, yy, step, 2); }
    // echo of the rising target
    const d = depthAt(tau), I = echoI(tau) * (tau < 0 ? 0.5 : 1);
    if (I > 0.02) {
      const sz = lerp(5, 20, 1 - d / 600) * (0.8 + 0.4 * hash(col, 312));
      ctx.fillStyle = `rgba(159,208,138,${0.8 * I})`; ctx.fillRect(px0 + cx, py0 + ph * d / 650 - sz / 2, step, sz);
    }
  }
  // sweep cursor
  ctx.fillStyle = 'rgba(159,208,138,0.5)'; ctx.fillRect(px0 + pw, py0, 2, ph);
  ctx.restore();
}

// ---------- weather ----------
const RAIN = Array.from({ length: 560 }, (_, i) => ({ x: hash(i, 21) * W * 1.5 - 0.3 * W, y: hash(i, 22) * (H + 300), v: 1600 + 1000 * hash(i, 23), a: 0.12 + 0.22 * hash(i, 24), w: 0.8 + 1.8 * hash(i, 25) }));
const SPRAYP = Array.from({ length: 34 }, (_, i) => ({ x: hash(i, 31) * W, y: hash(i, 32) * H, r: 2 + 12 * Math.pow(hash(i, 33), 1.5), v: 90 + 140 * hash(i, 34), a: 0.12 + 0.2 * hash(i, 35) }));
function drawRain(ctx, t, b, intensity = 1) {
  const ang = 16 * DEG, sn = Math.sin(ang), cs = Math.cos(ang);
  ctx.save(); ctx.lineCap = 'round';
  for (let bk = 0; bk < 4; bk++) {
    ctx.beginPath();
    for (let i = bk; i < RAIN.length; i += 4) {
      const r = RAIN[i], len = r.v / 30 * 0.9;
      const y = ((r.y + r.v * cs * t) % (H + 300)) - 150, x = ((r.x + r.v * sn * t) % (W * 1.5)) - 0.25 * W;
      ctx.moveTo(x, y); ctx.lineTo(x + sn * len, y + cs * len);
    }
    ctx.strokeStyle = `rgba(205,214,219,${(0.13 + bk * 0.065) * intensity})`; ctx.lineWidth = 0.9 + bk * 0.45; ctx.stroke();
  }
  const list = SPRAYP.map(p => [((p.x + p.v * t + 30 * Math.sin(t * 1.3 + p.y)) % (W + 60)) - 30, (p.y + 60 * t) % H, p.r, p.a]);
  sprayBlobs(ctx, list, intensity);
  ctx.restore();
}
// lens droplets (normal map)
const DROPS = Array.from({ length: 72 }, (_, i) => {
  const r = 3 + 15 * Math.pow(hash(i, 41), 2.2);
  return { x: hash(i, 42) * W / 2, y: hash(i, 43) * H / 2, r, e: 0.85 + 0.3 * hash(i, 44), slide: i < 6 ? 16 + 30 * hash(i, 45) : 0 };
});
function drawDrops(b, t) {
  const c = dctx; c.globalAlpha = 1; c.fillStyle = 'rgb(128,128,0)'; c.fillRect(0, 0, W / 2, H / 2);
  for (const d of DROPS) {
    let y = d.y;
    if (d.slide) {
      const s = d.slide * (t + 0.6 * Math.sin(t * 1.4 + d.x)); y = (d.y + Math.max(0, s)) % (H / 2);
      c.globalAlpha = 0.45; c.drawImage(dropSprite, d.x - d.r * 0.22, y - d.r * 5, d.r * 0.44, d.r * 4.6); c.globalAlpha = 1;
    }
    c.drawImage(dropSprite, d.x - d.r * d.e, y - d.r / d.e, 2 * d.r * d.e, 2 * d.r / d.e);
  }
  // spray bursts onto the lens at impacts
  for (let j = 0; j < JOLTS.length; j++) {
    const [jb, A] = JOLTS[j]; if (A < 20) continue;
    const age = (b - jb) * S; if (age < 0 || age > 3) continue;
    for (let i = 0; i < 26; i++) {
      const delay = hash(i, 500 + j) * 0.12; if (age < delay) continue;
      const r = 4 + 16 * Math.pow(hash(i, 510 + j), 1.8), x = hash(i, 520 + j) * W / 2, y = hash(i, 530 + j) * H / 2 + (age - delay) * 18 * hash(i, 540 + j);
      c.globalAlpha = 1 - ss(1.6, 3, age); c.drawImage(dropSprite, x - r, y - r, 2 * r, 2 * r);
    }
  }
  c.globalAlpha = 1;
}

// ---------- near-world layers per shot ----------
function nearTransform(ctx, cam, k = 1) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(W / 2 + cam.sx * 1.5 * k, H / 2 + cam.sy * 1.5 * k); ctx.rotate(cam.rollNear * k); ctx.translate(-W / 2, -H / 2);
}
const PUD = (seed, n, y0, y1) => Array.from({ length: n }, (_, i) => [hash(i, seed) * W, lerp(y0, y1, hash(i, seed + 1)), 140 + 220 * hash(i, seed + 2), 30 + 40 * hash(i, seed + 3)]);
const PUD_A = PUD(600, 6, 1350, 1850), PUD_D = PUD(610, 5, 1500, 1880), PUD_E = PUD(620, 4, 1720, 1900);

function nearA(ctx, cam, b, t) {
  nearTransform(ctx, cam, 1);
  // overhead rigging from the mast across the fog
  rope(ctx, 60, 120, 1180, 520, 140 + 14 * Math.sin(t * 0.9), 5);
  rope(ctx, 60, 260, 1180, 700, 90 + 10 * Math.sin(t * 1.1 + 1), 3);
  drawDeck(ctx, [[-300, 1180], [1400, 920], [1400, 2300], [-300, 2300]], [1350, 760], b, 600, PUD_A);
  drawRail(ctx, [1250, 905], [-200, 1215], 70, 190, 7, 20, 10, true);
  // hauling line: from the crew over the rail into the sea
  const pull = Math.sin(b * 2.4) * 0.5 + 0.5;
  rope(ctx, 905, 985, 1000, 900, 8, 5);
  rope(ctx, 370, 1420, 905, 985, 34 - pull * 10, 7);
  // net heap
  ctx.save();
  const heap = catmull([[300, 1830], [360, 1700], [520, 1650], [700, 1690], [820, 1790], [860, 1930], [280, 1960]], true, 6).map((p, k) => [p[0] + (hash(k, 640) - 0.5) * 10, p[1] + (hash(k, 641) - 0.5) * 10]);
  pathPts(ctx, heap); ctx.fillStyle = '#151c1e'; ctx.fill(); ctx.clip();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(58,71,78,0.55)';
  for (let i = -12; i < 18; i++) { ctx.beginPath(); ctx.moveTo(250 + i * 40, 1640); ctx.quadraticCurveTo(320 + i * 40, 1800, 260 + i * 40 + 120, 1980); ctx.stroke(); ctx.beginPath(); ctx.moveTo(900 - i * 40, 1640); ctx.quadraticCurveTo(820 - i * 40, 1800, 880 - i * 40 - 120, 1980); ctx.stroke(); }
  const hg = ctx.createLinearGradient(0, 1650, 0, 1950); hg.addColorStop(0, 'rgba(93,109,118,0.25)'); hg.addColorStop(1, 'rgba(11,18,18,0.6)'); ctx.fillStyle = hg; ctx.fillRect(250, 1640, 650, 330);
  ctx.restore();
  // crew hauling (lean back, weight shifts with the pull)
  const sw = k => 0.035 * Math.sin(t * 1.3 + k);
  personFogged(ctx, { x: 790, y: 1350, h: 250, lean: -0.12 + sw(2), handL: [0.18, -0.6], handR: [0.28, -0.58], armsBehind: true, turn: 0.3 }, 0.18);
  personFogged(ctx, { x: 600, y: 1440, h: 300, lean: -0.16 - pull * 0.04 + sw(1), handL: [0.12, -0.55], handR: [0.32, -0.6], armsBehind: true, stance: 0.14, legShift: 0.08 }, 0.08);
  drawPerson(ctx, { x: 380, y: 1585, h: 360, lean: -0.2 - pull * 0.05 + sw(0), handL: [0.2, -0.5], handR: [0.36, -0.56], armsBehind: true, stance: 0.15, legShift: 0.1, turn: -0.3 });
  // near structure: mast on the left edge (frame inside the frame)
  nearTransform(ctx, cam, 1.25);
  drawMast(ctx, -60, 120, -200, 2200, 650, { lamp: [150, 420] });
}
function nearB(ctx, cam, b, t) {
  nearTransform(ctx, cam, 1);
  const taut = ss(2.55, 2.62, b);
  const vib = taut * Math.exp(-(b - 2.6) * S * 5) * Math.sin((b - 2.6) * S * 60) * 10;
  // ship side + rail running low along the water
  drawRail(ctx, [-150, 1250], [1250, 1700], 120, 260, 12, 30, 7, true);
  // the net line: from the glove, over the rail, down into the sea
  const water = [330 + taut * 40, 1060 - taut * 30];
  rope(ctx, 640, 1480, water[0], water[1], lerp(-70, 0, taut) + vib, 8);
  rope(ctx, 900, 1800, 640, 1480, lerp(60, 4, taut) + vib * 0.5, 11);
  // spray where the line cuts the water when it snaps taut
  if (b > 2.58) {
    const age = (b - 2.6) * S; const list = [];
    for (let i = 0; i < 60; i++) { const tau = age - hash(i, 700) * 0.2; if (tau < 0 || tau > 1.1) continue; const v = 300 + 500 * hash(i, 701); list.push([water[0] + (hash(i, 702) - 0.5) * 80 + 60 * tau, water[1] - v * tau + 480 * tau * tau, 6 + 14 * hash(i, 703), 0.45 * (1 - tau / 1.1)]); }
    sprayBlobs(ctx, list);
  }
  // gloved arm of the crew member holding the line (enters from the bottom right)
  const pullArm = taut * ss(2.6, 2.9, b) * 60;
  ctx.save(); ctx.translate(pullArm * 0.6, -pullArm * 0.4 + vib * 0.3);
  ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(1180, 2080); ctx.quadraticCurveTo(1080, 1880, 930, 1810);
  ctx.strokeStyle = '#a23d22'; ctx.lineWidth = 120; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1150, 2040); ctx.quadraticCurveTo(1060, 1860, 930, 1790); ctx.strokeStyle = 'rgba(196,80,46,0.7)'; ctx.lineWidth = 40; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1190, 2090); ctx.quadraticCurveTo(1110, 1930, 980, 1860); ctx.strokeStyle = 'rgba(77,34,25,0.7)'; ctx.lineWidth = 30; ctx.stroke();
  ctx.fillStyle = 'rgba(180,194,203,0.5)'; ctx.save(); ctx.translate(1070, 1900); ctx.rotate(-0.95); ctx.fillRect(-60, -9, 120, 18); ctx.restore();
  ctx.fillStyle = '#1a2124'; ctx.beginPath(); ctx.ellipse(905, 1800, 58, 46, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // davit post, very near, on the left
  nearTransform(ctx, cam, 1.3);
  drawMast(ctx, -40, 95, -200, 2200, 660, { lamp: null });
}
function nearC(ctx, cam, b, t, subj) {
  nearTransform(ctx, cam, 1);
  drawRail(ctx, [-200, 1255], [1300, 1205], 150, 150, 18, 18, 8, true);
  drawDeck(ctx, [[-300, 1460], [1400, 1420], [1400, 2300], [-300, 2300]], [540, 1000], b, 630, PUD(630, 4, 1600, 1900));
  // taut line from the rail toward the creature's waterline: a leading line
  if (subj) {
    const w = subjLocalToWorld(subj, 3.0, -1.6, b), q = project(w[0] + 0.5, 0, w[2], cam);
    if (q) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      const inv = new DOMMatrix().translate(W / 2 + cam.sx * 1.5, H / 2 + cam.sy * 1.5).rotate(cam.rollNear / DEG).translate(-W / 2, -H / 2).inverse();
      ctx.restore();
      const qq = inv.transformPoint(new DOMPoint(q[0], q[1]));
      rope(ctx, 470, 1250, qq.x, qq.y, 0, 4.5, '#11181a', 0.18);
    }
  }
  const react = ss(4.25, 4.75, b);
  personFogged(ctx, { x: 285, y: 1530, h: 300, lean: -0.05 - 0.07 * react + 0.02 * Math.sin(t * 1.4), handL: [-0.32, -0.62], handR: [0.3, -0.65], armsBehind: false, turn: -0.5 }, 0.06);
  drawPerson(ctx, { x: 905, y: 2170, h: 1150, lean: 0.03 - 0.05 * react + 0.012 * Math.sin(t * 1.1), handL: [-0.27, -0.44], handR: [0.27, -0.46], turn: lerp(0.2, -0.6, react), stance: 0.12 });
  nearTransform(ctx, cam, 1.3);
  drawMast(ctx, -80, 150, -200, 2200, 670, { lamp: [180, 640] });
  rope(ctx, 150, 300, 150 + 300, -100, 0, 6);
}
function nearD(ctx, cam, b, t, subj) {
  nearTransform(ctx, cam, 1);
  const snap = 5.95, snapped = b >= snap;
  drawRail(ctx, [-200, 1450], [1300, 1290], 150, 150, 18, 18, 9, true);
  drawDeck(ctx, [[-300, 1640], [1400, 1480], [1400, 2300], [-300, 2300]], [700, 1000], b, 640, PUD_D);
  // the wave licking across the deck
  const prog = ss(5.6, 6.25, b);
  ctx.save();
  const front = lerp(-250, 1500, prog);
  const pts = [[-400, 1560]];
  for (let y = 1560; y <= 2300; y += 40) pts.push([front - (y - 1560) * 0.35 + (vn1(y * 0.02 + b * 3, 650) - 0.5) * 140, y]);
  pts.push([-400, 2300]);
  const wg = ctx.createLinearGradient(0, 1560, 0, 2200); wg.addColorStop(0, 'rgba(74,95,109,0.85)'); wg.addColorStop(1, 'rgba(44,62,74,0.9)');
  poly(ctx, pts, wg);
  const list = [];
  for (let i = 0; i < 160; i++) {
    const y = 1560 + hash(i, 660) * 720, fx = front - (y - 1560) * 0.35 - hash(i, 661) * 380 * (i % 3 ? 1 : 2.4);
    list.push([fx, y, 14 + 40 * hash(i, 662), 0.35 + 0.35 * hash(i, 663)]);
  }
  for (let i = 0; i < 70; i++) { const tau = (b - 5.6) * S - hash(i, 664) * 0.3; if (tau < 0) continue; list.push([lerp(-100, 900, hash(i, 665)), 1450 - (700 * hash(i, 666)) * tau + 900 * tau * tau, 20 + 50 * hash(i, 667), 0.4 * clamp(1 - tau)]); }
  sprayBlobs(ctx, list);
  ctx.restore();
  // the line: taut toward the passing flank, then it parts and whips back
  const rx = 820, ry = 1340;
  if (!snapped && subj) {
    const w = subjLocalToWorld(subj, 6, -0.6, b), q = project(w[0], 0.3, w[2], cam);
    if (q) { const inv = new DOMMatrix().translate(W / 2 + cam.sx * 1.5, H / 2 + cam.sy * 1.5).rotate(cam.rollNear / DEG).translate(-W / 2, -H / 2).inverse(); const qq = inv.transformPoint(new DOMPoint(q[0], q[1])); rope(ctx, rx, ry, qq.x, qq.y, 0, 6); }
  } else if (snapped) {
    const age = (b - snap) * S, k = Math.exp(-age * 4);
    const ex = rx - 380 * (1 - k) + 120 * k * Math.sin(age * 22), ey = ry + 260 * (1 - k) - 220 * k * Math.cos(age * 18);
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(rx, ry);
    ctx.bezierCurveTo(rx + 120 * k, ry - 200 * k, ex + 160, ey - 120 * k + 60, ex, ey);
    ctx.strokeStyle = '#11181a'; ctx.lineWidth = 7; ctx.stroke();
    if (age < 0.5) { const l = []; for (let i = 0; i < 24; i++) l.push([rx + (hash(i, 680) - 0.5) * 160 * (age + 0.2) * 4, ry - 200 * age * hash(i, 681), 8 + 12 * hash(i, 682), 0.5 * (1 - age * 2)]); sprayBlobs(ctx, l); }
  }
  // crew bracing; reaction ~8 frames after the impact / snap
  const r1 = ss(5.62 + 0.27, 5.62 + 0.6, b), r2 = ss(snap + 0.27, snap + 0.6, b);
  drawPerson(ctx, { x: 700, y: 1720, h: 520, lean: -0.08 - 0.12 * r2 + 0.02 * Math.sin(t * 2), handL: [-0.25, -0.75], handR: [0.32, -0.8], turn: 0.4 - r2 * 0.8, stance: 0.16, legShift: 0.1 * r1 });
  drawPerson(ctx, { x: 260, y: 2050, h: 820, lean: -0.1 - 0.1 * r1 - 0.06 * r2, handL: [-0.4, -0.7], handR: [0.42, -0.72], turn: -0.3, stance: 0.17 });
  nearTransform(ctx, cam, 1.3);
  drawMast(ctx, 930, 1160, -200, 2200, 690, { litRight: false });
}
function nearE(ctx, cam, b, t) {
  nearTransform(ctx, cam, 1);
  drawRail(ctx, [-200, 1600], [1300, 1530], 140, 150, 17, 18, 8, true);
  drawDeck(ctx, [[-300, 1790], [1400, 1720], [1400, 2300], [-300, 2300]], [540, 1200], b, 650, PUD_E);
  // the parted line hanging slack over the rail, swaying
  const sway = Math.sin(t * 1.2) * 18 + Math.sin(t * 2.7) * 6;
  ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(620, 1560); ctx.bezierCurveTo(690, 1540, 720 + sway * 0.4, 1600, 700 + sway, 1760);
  ctx.strokeStyle = '#11181a'; ctx.lineWidth = 7; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(700 + sway, 1760); ctx.lineTo(708 + sway * 1.1, 1790); ctx.lineWidth = 4; ctx.stroke();  // frayed end
  rope(ctx, 620, 1560, 380, 1900, 60, 7);
  drawPerson(ctx, { x: 300, y: 1830, h: 420, lean: 0.02 * Math.sin(t * 0.9), handL: [-0.3, -0.66], handR: [0.32, -0.64], turn: 0.2, stance: 0.12 });
}

// ---------- frame ----------
const READOUTS = [
  { tin: 0.35, tout: 3.45, x: 64, y: 330, label: 'DERİNLİK', size: 64, value: b => { const d = depthAt(b), fl = (b < 3.4 && hash(Math.floor(b * 30 * S), 900) < 0.35) ? (hash(Math.floor(b * 30 * S), 901) < 0.5 ? -1 : 1) : 0; return `${Math.max(0, Math.round(d) + fl)} M`; } },
  { tin: 1.15, tout: 3.45, x: 64, y: 520, label: 'GÖLGE BOYU', size: 64, value: b => { const k = b - 1.15; const v = k < 0.5 ? Math.round(18 * eio(k / 0.5)) + (hash(Math.floor(b * 30 * S), 902) < 0.4 ? 1 : 0) : 18; return `${v} M`; } },
  { tin: 3.95, tout: 5.5, x: W - 64, y: 520, align: 'right', label: 'SOYU TÜKENDİ SANILIYORDU', size: 56, value: b => (b - 3.95 < 0.4 && hash(Math.floor(b * 30 * S), 903) < 0.4) ? '3,7 MİLYON YIL' : '3,6 MİLYON YIL' },
  { tin: 4.3, tout: 5.5, x: W - 64, y: 720, align: 'right', label: 'DİŞ', size: 64, value: b => { const v = Math.round(18 * eio((b - 4.3) / 0.9)); return `${b - 4.3 < 0.9 && hash(Math.floor(b * 30 * S), 904) < 0.3 ? Math.max(0, v - 1) : v} CM`; }, callout: true },
  { tin: 6.45, tout: 8.2, x: W - 64, y: 300, align: 'right', label: 'KAYIT SAATİ', size: 64, value: () => '03:12' },
];

let lastB = -1;
function seek(t) {
  const b = t / S, shot = shotAt(b), cam = camState(t, b, shot);
  const subj = subjectState(b);
  // ---- subject canvas
  sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, W, H);
  if (subj) { drawSubject(sctx, subj, cam, b); drawSpray(sctx, subj, cam, b); }
  // ---- near canvas
  nctx.setTransform(1, 0, 0, 1, 0, 0); nctx.clearRect(0, 0, W, H);
  ({ A: nearA, B: nearB, C: nearC, D: nearD, E: nearE })[shot.id](nctx, cam, b, t, subj);
  nctx.setTransform(1, 0, 0, 1, 0, 0);
  // ---- text + rain canvas
  const c = tctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
  c.save(); c.translate(cam.sx * 0.25, cam.sy * 0.25);
  if (shot.id === 'A') drawSonar(c, W - 64 - 420, 150, 420, 300, b);
  if (shot.id === 'E') drawSonar(c, 64, 150, 420, 300, b);
  drawTitle(c, ['KARAYEL'], 64, 790 - 60, 132, 0.15, 1.75, t, cam);
  drawTitle(c, ['MEGALODON'], 64, 345, 112, 4.1, 5.5, t, cam);
  drawTitle(c, ['KARAYEL LİMANA DÖNDÜ.', 'GÖRÜNTÜ HİÇ AÇIKLANMADI.'], 64, 1080, 88, 6.55, 8.3, t, cam, 'left', 1.12);
  for (const r of READOUTS) {
    if (b < r.tin - 0.01 || b > r.tout + 0.3) continue;
    const res = drawReadout(c, { ...r, value: r.value(b) }, t);
    if (r.callout && res && subj) {
      const tooth = subjLocalToWorld(subj, 1.2, -0.45, b), q = project(tooth[0], tooth[1], tooth[2], cam);
      if (q) {
        c.save(); c.translate(-cam.sx * 0.25, -cam.sy * 0.25); c.globalAlpha = res.a * 0.85;
        const ex = r.x - res.vw - 24, ey = r.y - 22;
        c.strokeStyle = 'rgba(230,236,239,0.8)'; c.lineWidth = 2; c.setLineDash([]);
        c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(ex, ey); c.stroke();
        const L = Math.hypot(ex - q[0], ey - q[1]), ux = (ex - q[0]) / L, uy = (ey - q[1]) / L;
        for (let k = 1; k < 6; k++) { const px = q[0] + ux * L * k / 6, py = q[1] + uy * L * k / 6; c.beginPath(); c.moveTo(px - uy * 7, py + ux * 7); c.lineTo(px + uy * 7, py - ux * 7); c.stroke(); }
        c.beginPath(); c.arc(q[0], q[1], 7, 0, Math.PI * 2); c.stroke();
        c.restore();
      }
    }
  }
  c.restore();
  drawOSD(c, t);
  drawRain(c, t, b, shot.id === 'E' ? 0.8 : 1);
  drawDrops(b, t);

  // ---- GL: scene pass
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const up = (tex, cv) => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); };
  up(subjTex, subjC); up(nearTex, nearCv); up(txtTex, txtC);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); up(dropTex, dropC);

  let fogBoost = 1, nearFog = 0;
  if (shot.id === 'E') { const k = ss(6.6, 7.9, b); fogBoost = 1 + 2.6 * k; nearFog = 0.45 * k; }
  if (shot.id === 'C') fogBoost = lerp(1.25, 0.9, ss(3.5, 5.0, b));
  let bump = [0, 0, 0, 0];
  if (subj) {
    const wr = waterRange(subj, b);
    const cx = wr ? wr[0] + 2 : subj.px - 6;
    if (shot.id === 'C') bump = [cx, subj.Zs, 1.4 * ss(3.9, 4.6, b), Math.max(0, (b - 3.95) * S * 5)];
    else if (shot.id === 'D') bump = [cx + 3, subj.Zs, 1.0, 3 + (b - 5.3) * S * 5];
    else bump = [cx, subj.Zs, 0.6 * (1 - ss(6.3, 7.4, b)), (b - 6.0) * S * 5];
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, W, H);
  gl.useProgram(progScene.p); const u = progScene.u;
  gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uT, t); gl.uniform4f(u.uCam, cam.roll, cam.pitch, cam.yaw, cam.camH);
  gl.uniform1f(u.uTanH, TANH); gl.uniform1f(u.uFog, shot.fog); gl.uniform1f(u.uFogBoost, fogBoost);
  gl.uniform2f(u.uWind, 1.0, -0.3);
  gl.uniform4f(u.uSubjP, subj ? subj.Zs : 1, subj ? subj.fog : 0, subj ? 1 : 0, subj ? subj.blur : 1);
  gl.uniform4f(u.uBump, bump[0], bump[1], bump[2], bump[3]); gl.uniform1f(u.uNearFog, nearFog);
  const bindT = (unit, tex, name, prog) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.u[name], unit); };
  bindT(0, noiseTex, 'uNoise', progScene); bindT(1, subjTex, 'uSubj', progScene); bindT(2, nearTex, 'uNear', progScene); bindT(3, txtTex, 'uTxt', progScene);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindTexture(gl.TEXTURE_2D, sceneTex); gl.generateMipmap(gl.TEXTURE_2D);
  // ---- GL: lens + grade pass
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
  gl.useProgram(progLens.p); const v = progLens.u;
  gl.uniform2f(v.uRes, W, H); gl.uniform1f(v.uFrame, Math.round(t * FPS) % 997);
  // spray wipe around the wave impact (cut C -> D hidden under it)
  let wipe = [0, -1, 0];
  if (b >= 5.45 && b < 6.08) wipe = [lerp(0, 1.3, clamp((b - 5.45) / 0.1)), lerp(-0.4, 1.35, clamp((b - 5.72) / 0.34)), 1];
  gl.uniform3f(v.uWipe, wipe[0], wipe[1], wipe[2]);
  bindT(0, sceneTex, 'uScene', progLens); bindT(1, dropTex, 'uDrops', progLens); bindT(2, noiseTex, 'uNoise', progLens);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.finish();
  lastB = b;
  return true;
}
window.seek = seek;
window.CONFIG = CONFIG;
(async () => {
  await Promise.all([
    document.fonts.load(`600 100px ${COND}`, 'KARAYEL İŞĞÜÖÇ'), document.fonts.load(`500 30px ${MONO}`, 'DERİNLİK ŞĞÜÖÇ 0123'),
  ]);
  await document.fonts.ready;
  seek(0);
  window.ready = true;
})();
