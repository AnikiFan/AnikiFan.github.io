/* Original dreamlike procedural beach. One fullscreen triangle, no textures or media. */
(function () {
  "use strict";
  const hero = document.querySelector("[data-beach-hero]");
  if (!hero) return;
  const canvas = hero.querySelector("canvas");
  const motionButton = hero.querySelector(".hero__motion");
  const soundButton = hero.querySelector(".hero__sound");
  const status = hero.querySelector(".hero__status");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const connection = navigator.connection;
  const constrained = () => reducedMotion.matches || Boolean(connection &&
    (connection.saveData || /(^|-)2g$/.test(connection.effectiveType)));
  const mobile = matchMedia("(max-width: 767px)").matches;
  const frameInterval = 1000 / (mobile ? 20 : 24);
  let pixelBudget = mobile ? 230000 : 460000;
  let motionWanted = !constrained();
  let soundWanted = false;
  let inView = false;
  let leaving = false;
  let contextLost = false;
  let frame = 0;
  let lastFrame = 0;
  let sceneTime = 3;
  let slowFrames = 0;
  let gl, program, buffer, resolution, time;
  let sound;
  hero.querySelector(".hero__toolbar").hidden = false;

  const vertexSource = `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    float hash(vec2 p) {
      vec3 q = fract(vec3(p.xyx) * .1031);
      q += dot(q, q.yzx + 33.33);
      return fract((q.x + q.y) * q.z);
    }
    float noise(vec2 p) {
      vec2 i=floor(p), f=fract(p);
      f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
                 mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
    }
    float fbm(vec2 p) {
      return .57*noise(p)+.28*noise(p*2.03+7.1)+.15*noise(p*4.11+19.3);
    }
    void main() {
      vec2 uv=gl_FragCoord.xy/u_resolution;
      float aspect=u_resolution.x/u_resolution.y;
      float x=(uv.x-.5)*min(aspect,1.8);
      float t=u_time*.32;
      const float horizon=.61;
      vec2 sun=vec2(.69,.82);
      vec2 sunDelta=(uv-sun)*vec2(min(aspect,1.6),1.);
      float halo=exp(-dot(sunDelta,sunDelta)*14.);
      float core=exp(-dot(sunDelta,sunDelta)*1700.);

      // Soft lavender sky with a warm, diffuse sun. No hard disc or horizon.
      float skyHeight=clamp((uv.y-horizon)/(1.-horizon),0.,1.);
      vec3 sky=mix(vec3(.87,.85,.95),vec3(.39,.54,.85),skyHeight);
      sky=mix(sky,vec3(.99,.84,.82),halo*.62);
      sky+=vec3(1.,.93,.82)*core*.48;
      float cloud=fbm(vec2(x*1.5+t*.018,uv.y*7.));
      float cloudVeil=smoothstep(.42,.76,cloud)*smoothstep(horizon,.9,uv.y);
      sky=mix(sky,vec3(.91,.88,.98),cloudVeil*.24);

      float depth=clamp((horizon-uv.y)/horizon,0.,1.);
      // Perspective coordinates, with detail fading before it becomes subpixel.
      float z=1.8/(depth+.16);
      vec2 p=vec2(x*(1.+z*.32),z);
      float drift=fbm(p*vec2(.8,.45)+vec2(t*.07,-t*.12));
      float phase=p.y*2.6+t*.9+drift*3.+sin(p.x*.6)*.7;
      float swell=sin(phase)*.6+sin(p.y*1.4+p.x*.6+t*.6)*.4;
      float detail=smoothstep(.05,.3,depth);
      vec3 sea=mix(vec3(.60,.69,.91),vec3(.12,.34,.74),smoothstep(0.,.38,depth));
      sea=mix(sea,vec3(.22,.56,.89),smoothstep(.38,1.,depth));
      sea+=vec3(.06,.08,.12)*swell*.32*detail;
      sea+=vec3(.055,.07,.10)*(drift-.5)*detail;
      // Subdued, broad wave shoulders rather than high-contrast striped normals.
      float shoulder=pow(.5+.5*sin(phase),6.)*(.4+.6*drift);
      sea+=vec3(.14,.19,.27)*shoulder*.2*detail;

      // A soft path of scattered light; highlights stretch toward the viewer.
      float lightWidth=.018+depth*.15;
      float lightX=uv.x-sun.x+.012*sin(z*2.+t*.5);
      float lightPath=exp(-lightX*lightX/(lightWidth*lightWidth));
      float shimmer=fbm(vec2(x*16.,z*11.-t*.65));
      float reflectedLight=lightPath*(.22+.78*smoothstep(.3,.8,shimmer));
      sea=mix(sea,vec3(.86,.82,.99),reflectedLight*.28*detail);

      // Slow curved wash, with softly feathered foam and blue wet sand.
      float shore=.16+.055*sin(x*1.7+.4)+.045*x;
      shore+=.009*sin(t*.9+x*3.)+.004*sin(t*.63-x*5.);
      float d=uv.y-shore;
      float edgeNoise=fbm(vec2(x*16.,t*.12));
      float edge=d+.004*(edgeNoise-.5);
      vec3 sand=mix(vec3(.94,.82,.78),vec3(.98,.90,.83),clamp(uv.y/.25,0.,1.));
      sand+=(fbm(vec2(x*3.,uv.y*12.))-.5)*.022;
      float wet=exp(-abs(d)*27.);
      sand=mix(sand,vec3(.60,.70,.88),wet*.42);
      sea=mix(sea,vec3(.48,.72,.96),exp(-max(d,0.)*18.)*.55);
      float lace=1.-smoothstep(.001,.009,abs(edge));
      float backwash=1.-smoothstep(.002,.013,abs(d-.032-.007*sin(x*6.+t*.7)));
      float foam=(lace*.55+backwash*.14)*(.65+.35*edgeNoise);
      sea=mix(sea,vec3(.90,.92,1.),foam);
      vec3 coast=mix(sand,sea,smoothstep(-.007,.008,edge));

      // Atmospheric veils hide distant detail without a blur/post-processing pass.
      vec3 mist=vec3(.80,.81,.95);
      float seaMist=exp(-pow((uv.y-horizon)/.070,2.));
      coast=mix(coast,mist,seaMist*.85);
      sky=mix(sky,mist,exp(-pow((uv.y-horizon)/.10,2.))*.55);
      vec3 color=mix(coast,sky,smoothstep(horizon-.022,horizon+.025,uv.y));
      color+=vec3(.10,.065,.10)*halo*.22;
      // Subtle dithering keeps the broad gradients clean on 8-bit displays.
      color+=(hash(gl_FragCoord.xy)-.5)/255.;
      gl_FragColor=vec4(clamp(color,0.,1.),1.);
    }
  `;

  function labels() {
    motionButton.textContent = motionWanted ? "Pause waves" : "Play waves";
    motionButton.setAttribute("aria-pressed", String(motionWanted));
    soundButton.textContent = soundWanted ? "Sound on" : "Sound off";
    soundButton.setAttribute("aria-pressed", String(soundWanted));
    soundButton.setAttribute("aria-label", soundWanted ? "Turn off ocean sounds" : "Turn on ocean sounds");
  }
  function active() { return inView && !document.hidden && !leaving; }
  function resize() {
    const rect = hero.getBoundingClientRect();
    const scale = Math.min(1, Math.sqrt(pixelBudget / Math.max(1,rect.width*rect.height)));
    const width = Math.max(1,Math.round(rect.width*scale));
    const height = Math.max(1,Math.round(rect.height*scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (gl && program && !contextLost) draw();
  }
  function draw() {
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.uniform2f(resolution,canvas.width,canvas.height);
    gl.uniform1f(time,sceneTime);
    gl.drawArrays(gl.TRIANGLES,0,3);
    canvas.classList.add("is-ready");
  }
  function initGL() {
    gl = canvas.getContext("webgl", {alpha:false,antialias:false,depth:false,stencil:false,
      powerPreference:"low-power",preserveDrawingBuffer:false});
    if (!gl) throw new Error("WebGL unavailable");
    const shaders = [];
    try {
      for (const [type,source] of [[gl.VERTEX_SHADER,vertexSource],[gl.FRAGMENT_SHADER,fragmentSource]]) {
        const shader = gl.createShader(type);
        shaders.push(shader);
        gl.shaderSource(shader,source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      }
      program = gl.createProgram();
      shaders.forEach(shader=>gl.attachShader(program,shader));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program,"a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
      resolution = gl.getUniformLocation(program,"u_resolution");
      time = gl.getUniformLocation(program,"u_time");
      resize();
    } finally { shaders.forEach(shader=>gl.deleteShader(shader)); }
  }
  function unavailable() {
    if (gl && program) gl.deleteProgram(program);
    if (gl && buffer) gl.deleteBuffer(buffer);
    program = null;
    motionWanted = false;
    motionButton.disabled = true;
    canvas.classList.remove("is-ready");
    status.textContent = "Showing a still beach. Live rendering is unavailable.";
    sync();
  }
  function animate(now) {
    frame = 0;
    if (!active() || !motionWanted || !program || contextLost) return;
    const elapsed = now-lastFrame;
    if (!lastFrame || elapsed >= frameInterval) {
      if (lastFrame) {
        sceneTime += Math.min(elapsed,100)/1000;
        slowFrames = elapsed > 85 ? slowFrames+1 : Math.max(0,slowFrames-1);
        if (slowFrames >= 12 && pixelBudget > 90000) {
          pixelBudget = Math.max(90000,Math.floor(pixelBudget*.75));
          slowFrames = 0;
          resize();
        }
      }
      lastFrame = now;
      draw();
    }
    frame = requestAnimationFrame(animate);
  }
  // Filtered noise and very slow gain/filter modulation synthesize the surf.
  // All oscillators run in the audio graph; no audio work is done per frame.
  function createSound() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error("Web Audio unavailable");
    const context = new Audio();
    const nodes = [];
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    let seed = 9173;
    function random() { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296*2-1; }
    const noiseBuffer = context.createBuffer(2,context.sampleRate*4,context.sampleRate);
    for(let ch=0;ch<2;ch++) {
      const data = noiseBuffer.getChannelData(ch);
      let low = 0;
      for(let i=0;i<data.length;i++) { low=(low+.03*random())/1.03; data[i]=low*3.5; }
      // Blend the wrap to avoid a click at the buffer boundary.
      const blend = Math.floor(context.sampleRate*.04);
      for(let i=0;i<blend;i++) {
        const amount=i/blend;
        data[data.length-blend+i] = data[data.length-blend+i]*(1-amount)+data[i]*amount;
      }
    }
    for(let i=0;i<2;i++) {
      const source=context.createBufferSource(); source.buffer=noiseBuffer; source.loop=true;
      const filter=context.createBiquadFilter(); filter.type="lowpass"; filter.frequency.value=900+i*500; filter.Q.value=.4;
      const gain=context.createGain(); gain.gain.value=.18;
      const swell=context.createOscillator(); swell.frequency.value=.10+i*.037;
      const depth=context.createGain(); depth.gain.value=.13;
      swell.connect(depth); depth.connect(gain.gain);
      const shimmer=context.createGain(); shimmer.gain.value=500;
      swell.connect(shimmer); shimmer.connect(filter.frequency);
      source.connect(filter); filter.connect(gain); gain.connect(master);
      source.start(0,i*1.37); swell.start();
      nodes.push(source,filter,gain,swell,depth,shimmer);
    }
    return {context,master,nodes};
  }
  let soundRevision=0;
  async function syncSound() {
    if (!sound) return;
    const revision=++soundRevision;
    const {context,master}=sound;
    try {
      if (active() && soundWanted) {
        await context.resume();
        if (revision !== soundRevision) return;
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setTargetAtTime(.65,context.currentTime,.2);
      } else {
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setValueAtTime(0,context.currentTime);
        await context.suspend();
      }
    } catch (_) {
      if(revision !== soundRevision) return;
      soundWanted=false;
      status.textContent="Sound could not start. Tap Sound off to retry.";
      labels();
    }
  }
  function sync() {
    cancelAnimationFrame(frame); frame=0; lastFrame=0;
    if(active() && motionWanted && program && !contextLost) frame=requestAnimationFrame(animate);
    syncSound();
    labels();
  }
  motionButton.addEventListener("click",()=>{ motionWanted=!motionWanted; status.textContent=""; sync(); });
  soundButton.addEventListener("click",()=>{
    soundWanted=!soundWanted;
    status.textContent="";
    if(soundWanted && !sound) {
      try { sound=createSound(); } catch (_) {
        soundWanted=false; soundButton.disabled=true;
        status.textContent="Ocean sounds are unavailable in this browser.";
      }
    }
    sync();
  });
  function respectPreferences() { if(constrained()) motionWanted=false; sync(); }
  reducedMotion.addEventListener("change",respectPreferences);
  if(connection) connection.addEventListener("change",respectPreferences);
  document.addEventListener("visibilitychange",sync);
  window.addEventListener("pagehide",()=>{leaving=true;sync();});
  window.addEventListener("pageshow",()=>{leaving=false;sync();});
  canvas.addEventListener("webglcontextlost",event=>{
    event.preventDefault(); contextLost=true;
    canvas.classList.remove("is-ready"); sync();
  });
  canvas.addEventListener("webglcontextrestored",()=>{
    contextLost=false;
    try {initGL();sync();} catch (_) {unavailable();}
  });
  try {initGL();} catch (_) {unavailable();}
  if("ResizeObserver" in window) new ResizeObserver(resize).observe(hero);
  else window.addEventListener("resize",resize);
  if("IntersectionObserver" in window) {
    new IntersectionObserver(entries=>{
      inView=entries[0].isIntersecting && entries[0].intersectionRatio>=.05;
      sync();
    },{threshold:[0,.05]}).observe(hero);
  } else {inView=true; motionWanted=false;}
  labels();
})();
