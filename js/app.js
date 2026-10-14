(() => {
  const canvas = document.querySelector('#scene');
  const ctx = canvas.getContext('2d', { alpha: false });
  const image = new Image();
  const sources = [{ name: 'Original portrait', src: 'assets/original-portrait.jpg', fallback: window.PORTRAIT_FALLBACK_SRC || '' }];
  let activeSource = 0;
  image.decoding = 'async';
  let W=0,H=0,dpr=1, particles=[], running=true, repel=false, energy=1;
  let particleColor='#f5f7ff';
  let study='portrait', links=[], renderedX=new Float32Array(0), renderedY=new Float32Array(0);
  const studyNames={portrait:'Breathing portrait',orbit:'Orbital bloom',flow:'Electric current',constellation:'Constellation',kaleidoscope:'Kaleidoscope'};
  const fieldPoint={x:0,y:0};
  const pointer={x:-1000,y:-1000,active:false};
  let randomState=1;
  let frameId=0;
  const ownedImageUrls=new Set();
  function seededRandom(a,b){
    randomState=(randomState*1664525+1013904223)>>>0;
    return a+(randomState/4294967296)*(b-a);
  }
  function handleImageLoad(){
    renderImageTools();
    if(resize()){ scheduleDraw(); return; }
    const source=sources[activeSource];
    if(source && source.fallback && image.src!==source.fallback){
      source.src=source.fallback;
      image.src=source.fallback;
      scheduleDraw();
      return;
    }
    document.querySelector('#status').textContent='Image pixels blocked by the browser — serve this folder over HTTP';
    scheduleDraw();
  }
  function loadSource(index){
    const source=sources[index];
    if(!source) return;
    activeSource=index;
    renderImageTools();
    document.querySelector('#status').textContent='Loading image';
    image.onload=handleImageLoad;
    image.onerror=()=>{document.querySelector('#status').textContent=`Could not load ${source.name}`;};
    image.src=source.src;
    if(image.complete && image.naturalWidth) handleImageLoad();
  }
  function readImageFile(file){
    const src=URL.createObjectURL(file);
    ownedImageUrls.add(src);
    return Promise.resolve({name:file.name,src});
  }

  function resize(){
    dpr=Math.min(window.devicePixelRatio||1,2);
    W=innerWidth; H=innerHeight;
    canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(image.complete && image.naturalWidth) return makeParticles();
    return true;
  }
  function makeParticles(){
    if (!image.naturalWidth || !image.naturalHeight) return true;
    // Recreate the same particle layout whenever this source is resized.
    randomState=(activeSource+1)>>>0;
    const off=document.createElement('canvas');
    const ow=360, oh=Math.round(ow*image.naturalHeight/image.naturalWidth);
    off.width=ow; off.height=oh;
    const oc=off.getContext('2d',{willReadFrequently:true});
    oc.drawImage(image,0,0,ow,oh);
    let pixels;
    try{
      pixels=oc.getImageData(0,0,ow,oh).data;
    }catch(error){
      return false;
    }
    const scale=Math.min(W*.78/ow,H*.78/oh);
    const drawW=ow*scale, drawH=oh*scale;
    const left=(W-drawW)/2, top=(H-drawH)/2;
    const next=[];
    // Sample more densely where the image is bright; retain the surrounding dark field too.
    const step=1.65;
    for(let y=0;y<oh;y+=step){
      for(let x=0;x<ow;x+=step){
        const i=(Math.floor(y)*ow+Math.floor(x))*4;
        const lum=(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722)/255;
        if(seededRandom(0,1) < .04 + lum*.88){
          const bx=left+x*scale, by=top+y*scale;
          const brightness=Math.max(0,Math.min(1,(lum-.12)/.78));
          next.push({
            x:bx,y:by,ox:bx,oy:by,
            phase:seededRandom(0,Math.PI*2), speed:seededRandom(.45,1.7),
            size:seededRandom(.35,1.25)+(brightness*.45),
            alpha:Math.min(.95,.12+lum*1.15),
            drift:seededRandom(1,8), lum
          });
        }
      }
    }
    // Sparse drifting dust around the portrait adds depth.
    const dustCount=Math.floor(W*H/5000);
    for(let i=0;i<dustCount;i++){
      const x=seededRandom(0,W),y=seededRandom(0,H);
      if(seededRandom(0,1)<.7) next.push({x,y,ox:x,oy:y,phase:seededRandom(0,6.28),speed:seededRandom(.2,.8),size:seededRandom(.25,.7),alpha:seededRandom(.05,.24),drift:seededRandom(3,15),lum:seededRandom(.1,.4),dust:true});
    }
    particles=next;
    links=study==='constellation'?buildLinks(particles):[];
    updateStatus();
    scheduleDraw();
    return true;
  }
  function buildLinks(points){
    const cellSize=32,maxDistance=42,cells=new Map(),result=[];
    const key=(x,y)=>`${x},${y}`;
    points.forEach((p,index)=>{
      const cellX=Math.floor(p.ox/cellSize),cellY=Math.floor(p.oy/cellSize);
      const bucket=cells.get(key(cellX,cellY))||[];
      let best=-1,bestDistance=maxDistance;
      for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++){
        for(const other of cells.get(key(cellX+ox,cellY+oy))||[]){
          const candidate=points[other];
          const distance=Math.hypot(candidate.ox-p.ox,candidate.oy-p.oy);
          if(distance<bestDistance){best=other;bestDistance=distance;}
        }
      }
      if(best>=0) result.push([index,best]);
      bucket.push(index);cells.set(key(cellX,cellY),bucket);
    });
    return result;
  }
  function updateStatus(){
    document.querySelector('#status').textContent=`${studyNames[study]} · ${particles.length.toLocaleString()} particles`;
  }
  function applyField(fieldX,fieldY,fieldRepels){
    const dx=fieldPoint.x-fieldX,dy=fieldPoint.y-fieldY,distance=Math.hypot(dx,dy),radius=130;
    if(distance>=radius||distance<=.1) return;
    const force=(1-distance/radius)*(fieldRepels?1:-1)*26*energy;
    fieldPoint.x+=dx/distance*force;fieldPoint.y+=dy/distance*force;
  }
  function scheduleDraw(){
    if(!frameId && !document.hidden) frameId=requestAnimationFrame(draw);
  }
  function draw(now){
    frameId=0;
    if(document.hidden) return;
    ctx.fillStyle='#050505';
    ctx.fillRect(0,0,W,H);
    // Soft vignette
    const vg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.12,W/2,H/2,Math.max(W,H)*.72);
    vg.addColorStop(0,'rgba(22,22,22,.12)'); vg.addColorStop(1,'rgba(0,0,0,.5)');
    ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
    const t=now*.001;
    const red=parseInt(particleColor.slice(1,3),16),green=parseInt(particleColor.slice(3,5),16),blue=parseInt(particleColor.slice(5,7),16);
    if(study==='constellation'&&(renderedX.length!==particles.length)){
      renderedX=new Float32Array(particles.length);renderedY=new Float32Array(particles.length);
    }
    ctx.globalCompositeOperation='lighter';
    for(let index=0;index<particles.length;index++){
      const p=particles[index];
      let dx=0,dy=0;
      if(running){
        const breath=Math.sin(t*.72)*1.8*energy;
        if(study==='orbit'){
          const angle=t*.16,rx=p.ox-W/2,ry=p.oy-H/2;
          dx=(rx*Math.cos(angle)-ry*Math.sin(angle))-rx;
          dy=(rx*Math.sin(angle)+ry*Math.cos(angle))-ry;
          dx+=Math.sin(t*p.speed+p.phase)*p.drift*.12*energy;
          dy+=breath;
        }else if(study==='flow'){
          dx=Math.sin(p.oy*.012+t*.8+p.phase)*18*energy;
          dy=Math.cos(p.ox*.012-t*.65+p.phase)*14*energy;
        }else if(study==='kaleidoscope'){
          const rx=p.ox-W/2,ry=p.oy-H/2,radius=Math.hypot(rx,ry);
          const segment=Math.PI/3,angle=Math.atan2(ry,rx)+t*.06;
          const sector=Math.floor(((angle%(Math.PI*2))+(Math.PI*2))%(Math.PI*2)/segment);
          const local=((angle%(Math.PI*2))+(Math.PI*2))%segment;
          const folded=sector*segment+(sector%2?segment-local:local);
          dx=radius*Math.cos(folded)-rx;dy=radius*Math.sin(folded)-ry;
          dy+=breath;
        }else{
          dx=Math.sin(t*p.speed+p.phase)*p.drift*.24*energy;
          dy=Math.cos(t*p.speed*.8+p.phase*1.3)*p.drift*.25*energy+breath;
        }
      }
      fieldPoint.x=p.ox+dx;fieldPoint.y=p.oy+dy;
      if(pointer.active) applyField(pointer.x,pointer.y,repel);
      const x=fieldPoint.x,y=fieldPoint.y;
      if(study==='constellation'){renderedX[index]=x;renderedY[index]=y;}
      const twinkle=running ? .72+.28*Math.sin(t*2.1*p.speed+p.phase) : 1;
      ctx.fillStyle=`rgba(${red},${green},${blue},${p.alpha*twinkle})`;
      ctx.beginPath();ctx.arc(x,y,p.size,0,Math.PI*2);ctx.fill();
    }
    if(study==='constellation'){
      ctx.beginPath();ctx.lineWidth=.65;ctx.strokeStyle=`rgba(${red},${green},${blue},.16)`;
      for(const [a,b] of links){ctx.moveTo(renderedX[a],renderedY[a]);ctx.lineTo(renderedX[b],renderedY[b]);}
      ctx.stroke();
    }
    ctx.globalCompositeOperation='source-over';
    if(running) scheduleDraw();
  }
  canvas.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.active=true;if(!running)scheduleDraw();});
  canvas.addEventListener('pointerleave',()=>{pointer.active=false;if(!running)scheduleDraw();});
  document.querySelector('#motionBtn').addEventListener('click',e=>{
    running=!running;e.currentTarget.classList.toggle('active',running);
    e.currentTarget.textContent=running?'Motion on':'Motion off';
    e.currentTarget.setAttribute('aria-pressed',String(running));
    scheduleDraw();
  });
  document.querySelector('#studySelect').addEventListener('change',e=>{
    study=e.target.value;
    links=study==='constellation'?buildLinks(particles):[];
    updateStatus();
    scheduleDraw();
  });
  document.querySelector('#modeBtn').addEventListener('click',e=>{
    repel=!repel;e.currentTarget.textContent=repel?'Repel':'Attract';
    e.currentTarget.setAttribute('aria-pressed',String(repel));
    if(!running)scheduleDraw();
  });
  document.querySelector('#energy').addEventListener('input',e=>{energy=Number(e.target.value);if(!running)scheduleDraw();});
  document.querySelector('#particleColor').addEventListener('input',e=>{
    particleColor=e.target.value;
    if(!running)scheduleDraw();
  });
  const fileInput=document.querySelector('#fileInput');
  const imageTools=document.querySelector('#imageTools');
  const dropNote=document.querySelector('#dropNote');
  function renderImageTools(){
    imageTools.querySelectorAll('.thumb').forEach(el=>el.remove());
    sources.forEach((source,index)=>{
      const button=document.createElement('button');
      button.className='thumb'+(index===activeSource?' active':'');
      button.title=source.name;
      button.setAttribute('aria-label',`Use image: ${source.name}`);
      button.setAttribute('aria-pressed',String(index===activeSource));
      const thumb=document.createElement('img');
      thumb.src=source.src; thumb.alt=source.name;
      button.appendChild(thumb);
      button.addEventListener('click',()=>loadSource(index));
      imageTools.insertBefore(button,fileInput);
    });
  }
  function addFiles(fileList){
    const files=Array.from(fileList||[]).filter(file=>file.type.startsWith('image/'));
    if(!files.length) return;
    const oversized=files.find(file=>file.size>20*1024*1024);
    if(oversized){
      document.querySelector('#status').textContent=`${oversized.name} exceeds the 20 MB image limit`;
      return;
    }
    Promise.all(files.map(readImageFile)).then(loaded=>{
      const firstNewIndex=sources.length;
      sources.push(...loaded);
      renderImageTools();
      loadSource(firstNewIndex+loaded.length-1);
    }).catch(error=>{
      document.querySelector('#status').textContent=error.message;
    });
  }
  document.querySelector('#uploadBtn').addEventListener('click',()=>fileInput.click());
  document.querySelector('#saveBtn').addEventListener('click',()=>{
    // Save a clean still of the current particle portrait, excluding the UI overlay.
    const saveBtn=document.querySelector('#saveBtn');
    saveBtn.textContent='Saving…';
    try {
      const exportCanvas=document.createElement('canvas');
      exportCanvas.width=canvas.width;
      exportCanvas.height=canvas.height;
      const exportCtx=exportCanvas.getContext('2d');
      exportCtx.drawImage(canvas,0,0);
      exportCanvas.toBlob(blob=>{
        if(!blob){
          saveBtn.textContent='Save failed';
          setTimeout(()=>saveBtn.textContent='↓ Save image',1400);
          return;
        }
        const url=URL.createObjectURL(blob);
        const link=document.createElement('a');
        const safeName=(sources[activeSource]?.name||'living-particles').replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'-').toLowerCase();
        link.href=url;
        link.download=safeName+'-particles.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
        saveBtn.textContent='Saved ✓';
        setTimeout(()=>saveBtn.textContent='↓ Save image',1600);
      },'image/png');
    } catch(err) {
      saveBtn.textContent='Save failed';
      setTimeout(()=>saveBtn.textContent='↓ Save image',1400);
    }
  });
  fileInput.addEventListener('change',e=>{addFiles(e.target.files);fileInput.value='';});
  ['dragenter','dragover'].forEach(type=>window.addEventListener(type,e=>{e.preventDefault();dropNote.classList.add('show');}));
  ['dragleave','drop'].forEach(type=>window.addEventListener(type,e=>{e.preventDefault();if(type==='drop')addFiles(e.dataTransfer.files);dropNote.classList.remove('show');}));
  image.onerror=()=>{document.querySelector('#status').textContent='Could not load the original portrait';};
  image.onload=handleImageLoad;
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden && frameId){cancelAnimationFrame(frameId);frameId=0;}
    else scheduleDraw();
  });
  window.addEventListener('pagehide',event=>{
    if(!event.persisted){ownedImageUrls.forEach(URL.revokeObjectURL);ownedImageUrls.clear();}
  });
  image.src=sources[0].src;
  if(image.complete && image.naturalWidth) handleImageLoad();
  scheduleDraw();
})();
