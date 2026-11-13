/* Original procedural beach. One fullscreen triangle, no textures or media. */
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
    vec3 sunDirection() { return normalize(vec3(min(.32,u_resolution.x/u_resolution.y*.18),.24,1.)); }
    float hash(vec2 p) {
      vec3 q = fract(vec3(p.xyx) * 0.1031);
      q += dot(q, q.yzx + 33.33);
      return fract((q.x + q.y) * q.z);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x),
                 mix(hash(i+vec2(0.,1.)), hash(i+1.), f.x), f.y);
    }
    float fbm(vec2 p) {
      return .57*noise(p) + .28*noise(p*2.03+7.1) + .15*noise(p*4.11+19.3);
    }
    vec3 sky(vec3 rd) {
      float y = max(rd.y, 0.);
      vec3 color = mix(vec3(.81,.91,.92), vec3(.26,.61,.83), pow(y,.45));
      float sun = max(dot(rd,sunDirection()),0.);
      color += vec3(1.,.80,.49)*pow(sun,20.)*.25;
      color += vec3(1.,.91,.70)*smoothstep(.99982,.99996,sun)*1.8;
      if (rd.y > .025) {
        vec2 p = rd.xz / (rd.y+.12);
        float clouds = smoothstep(.56,.79,fbm(p*1.2+vec2(u_time*.003,0.)));
        color = mix(color,vec3(1.,.98,.92),clouds*.40*smoothstep(.025,.16,rd.y));
      }
      return color;
    }
    // Height and analytic derivatives: no multi-sample normal reconstruction.
    vec3 swell(vec2 p) {
      float a = p.y*1.08 + u_time*.82 + .52*sin(p.x*.33);
      float b = dot(p,vec2(.63,1.6)) + u_time*1.12;
      float c = dot(p,vec2(-1.8,2.8)) + u_time*1.43;
      float h = .19*sin(a) + .042*sin(2.*a) + .046*sin(b) + .016*sin(c);
      float d = .19*cos(a) + .084*cos(2.*a);
      return vec3(h, d*.1716*cos(p.x*.33)+.02898*cos(b)-.0288*cos(c),
                  d*1.08+.0736*cos(b)+.0448*cos(c));
    }
    void main() {
      vec2 uv = gl_FragCoord.xy/u_resolution;
      float aspect = u_resolution.x/u_resolution.y;
      vec3 ro = vec3(0.,3.8,-5.);
      vec3 rd = normalize(vec3((uv.x-.5)*aspect*.95,(uv.y-.64)*.95,.88));
      vec3 color;
      if (rd.y >= -.003) {
        color = sky(rd);
      } else {
        float distance = min(-ro.y/rd.y,650.);
        vec3 p = ro + rd*distance;
        // Two bounded corrections to intersect the moving height field.
        for(int i=0;i<2;i++) {
          float height = swell(p.xz).x * smoothstep(3.0,7.0,p.z);
          distance = clamp((height-ro.y)/rd.y,0.,650.);
          p = ro + rd*distance;
        }
        vec2 q = p.xz;
        float shore = 3.4 + .32*sin(q.x*.28) + q.x*.08;
        float wash = .36*sin(u_time*.82) + .10*sin(q.x*.8+u_time*.45);
        float depth = (q.y-shore-wash)*.23;
        float grain = noise(q*95.);
        float sandPattern = fbm(q*4.);
        vec3 sand = vec3(.96,.84,.63) + (sandPattern-.5)*.075 + (grain-.5)*.035;
        float wet = smoothstep(-.6,.15,depth);
        sand *= 1.-.23*wet;
        vec3 wave = swell(q);
        float attenuation = smoothstep(-.05,1.3,depth);
        float rippleA = dot(q,vec2(14.,9.))+u_time*1.5;
        float rippleB = dot(q,vec2(-9.,17.))-u_time*1.8;
        vec2 ripple = vec2(cos(rippleA)*.028-cos(rippleB)*.019,
                           cos(rippleA)*.018+cos(rippleB)*.036);
        // Fade subpixel ripples toward the horizon to prevent sparkling aliases.
        ripple *= 1.-smoothstep(12.,55.,distance);
        float distant = 1.-smoothstep(20.,100.,distance);
        vec3 normal = normalize(vec3(-(wave.y*distant+ripple.x)*attenuation,1.,-(wave.z*distant+ripple.y)*attenuation));
        vec3 reflected = reflect(rd,normal);
        float fresnel = .025 + .975*pow(1.-max(dot(-rd,normal),0.),5.);
        vec3 deep = vec3(.025,.26,.33);
        vec3 shallow = vec3(.13,.63,.58);
        vec3 water = mix(shallow,deep,1.-exp(-max(depth,0.)*.17));
        float caustic = pow(max(0.,sin(q.x*5.+wave.x*3.)*sin(q.y*6.-u_time*.55)),6.);
        vec3 bottom = sand*vec3(.69,.94,.84) + caustic*.08;
        water = mix(bottom,water,1.-exp(-max(depth,0.)*1.7));
        water = mix(water,sky(reflected),clamp(fresnel,.0,.88));
        float specular = pow(max(dot(reflected,sunDirection()),0.),160.);
        water += vec3(1.,.9,.64)*specular*.9;
        float phase = q.y*1.08+u_time*.82+.52*sin(q.x*.33);
        float crest = smoothstep(.84,1.,sin(phase));
        float breakup = fbm(q*vec2(3.8,6.)+vec2(0.,u_time*.24));
        float breakers = crest*smoothstep(.25,.65,breakup)*(1.-smoothstep(1.0,3.3,depth));
        float edge = (1.-smoothstep(.015,.22,abs(depth)))*smoothstep(.28,.6,breakup);
        float trails = smoothstep(.63,.88,breakup)*(1.-smoothstep(0.,.8,depth))*.3;
        float foam = clamp(breakers*.83+edge*.86+trails,0.,.94);
        water = mix(water,vec3(.94,.98,.92),foam);
        color = mix(sand,water,smoothstep(-.035,.035,depth));
        color = mix(color,sky(normalize(vec3(rd.x,0.,rd.z))),1.-exp(-distance*.006));
      }
      // Gentle exposure rolloff keeps sun glints bright without a white screen.
      color = color/(1.+max(color-1.,0.));
      gl_FragColor = vec4(pow(max(color,0.),vec3(.94)),1.);
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
