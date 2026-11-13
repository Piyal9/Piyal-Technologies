(function(){
  var $=function(s){return document.querySelector(s)};
  var MAX=8000, img=null, srcW=0, srcH=0, base='image', origInfo='', origUrl=null, outUrl=null, token=0, timer=null, origSize=0;
  var el={file:$('#file'),drop:$('#drop'),prev:$('#preview'),out:$('#out'),stats:$('#stats'),w:$('#w'),h:$('#h'),ratio:$('#ratio'),
    fit:$('#fit'),fitRow:$('#fitRow'),q:$('#q'),qv:$('#qv'),bg:$('#bg'),tr:$('#tr'),mode:$('#mode'),detail:$('#detail'),dv:$('#dv'),
    lv:$('#lv'),lvv:$('#lvv'),dl:$('#dl'),msg:$('#msg'),qGroup:$('#qGroup'),svgGroup:$('#svgGroup'),traceOpts:$('#traceOpts')};
  var EXT={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/bmp':'bmp','image/svg+xml':'svg'};

  function fmtVal(){return document.querySelector('input[name=fmt]:checked').value}
  function clamp(v){v=Math.round(+v);return Math.min(MAX,Math.max(1,v||1))}
  function bytes(n){return n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(2)+' MB'}
  function ratioVal(){
    var r=el.ratio.value;
    if(r==='original')return (srcW/srcH)||1;
    if(r==='free')return null;
    var p=r.split(':').map(Number);return p[0]/p[1];
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(render,120)}
  function after(){syncUI();schedule()}

  function syncUI(){
    var f=fmtVal();
    el.qGroup.hidden=!(f==='jpeg'||f==='webp');
    el.svgGroup.hidden=f!=='svg';
    el.traceOpts.hidden=!(f==='svg'&&el.mode.value==='trace');
    var solid=(f==='jpeg'||f==='bmp');
    el.tr.disabled=solid;
    if(solid)el.tr.checked=false;
    var w=+el.w.value,h=+el.h.value;
    el.fitRow.hidden=!(img&&w>0&&h>0&&Math.abs((w/h)/(srcW/srcH)-1)>0.01);
    el.qv.textContent=el.q.value;el.dv.textContent=el.detail.value;el.lvv.textContent=el.lv.value;
  }

  function loadFile(f){
    if(!f)return;
    var u=URL.createObjectURL(f),im=new Image();
    im.onload=function(){
      if(origUrl)URL.revokeObjectURL(origUrl);
      origUrl=u;img=im;origSize=f.size;
      srcW=im.naturalWidth||512;srcH=im.naturalHeight||512;
      base=f.name.replace(/\.[^.]+$/,'')||'image';
      var t=(f.type.split('/')[1]||f.name.split('.').pop()||'image').replace('svg+xml','svg').replace('jpeg','jpg').toUpperCase();
      origInfo=srcW+' × '+srcH+' '+t+', '+bytes(f.size);
      el.ratio.value='original';el.w.value=srcW;el.h.value=srcH;
      el.drop.hidden=true;el.prev.hidden=false;el.msg.textContent='';
      syncUI();render();
    };
    im.onerror=function(){
      URL.revokeObjectURL(u);
      el.msg.textContent='That file couldn’t be read as an image. Try JPG, PNG, WebP, GIF, BMP, SVG or AVIF.';
    };
    im.src=u;
  }

  function draw(x,w,h){
    var fit=el.fit.value,same=Math.abs((w/h)/(srcW/srcH)-1)<=0.01;
    if(same||fit==='stretch'){x.drawImage(img,0,0,w,h);return}
    if(fit==='crop'){
      var s=Math.max(w/srcW,h/srcH),sw=w/s,sh=h/s;
      x.drawImage(img,(srcW-sw)/2,(srcH-sh)/2,sw,sh,0,0,w,h);
    }else{
      var k=Math.min(w/srcW,h/srcH),dw=srcW*k,dh=srcH*k;
      x.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);
    }
  }

  function render(){
    if(!img)return;
    var my=++token,f=fmtVal(),w=clamp(el.w.value),h=clamp(el.h.value);
    var c=document.createElement('canvas');c.width=w;c.height=h;
    var x=c.getContext('2d');x.imageSmoothingQuality='high';
    var solid=(f==='jpeg'||f==='bmp'||!el.tr.checked);
    if(solid){x.fillStyle=el.bg.value;x.fillRect(0,0,w,h)}
    try{draw(x,w,h)}catch(e){el.msg.textContent='Could not draw this image.';return}
    el.msg.textContent='';
    function done(blob,extra){
      if(my!==token)return;
      if(!blob){el.msg.textContent='Your browser couldn’t create that file. Try a smaller size or another format.';return}
      if(outUrl)URL.revokeObjectURL(outUrl);
      outUrl=URL.createObjectURL(blob);
      el.out.src=outUrl;
      var ext=EXT[blob.type]||f;
      el.dl.href=outUrl;el.dl.download=base+'.'+ext;el.dl.setAttribute('aria-disabled','false');
      var diff=origSize?Math.round((blob.size/origSize-1)*100):0;
      var d=document.createElement('div');
      d.innerHTML='<span>Original</span><b></b><span>Output</span><b></b>';
      var bs=d.querySelectorAll('b');
      bs[0].textContent=origInfo;
      bs[1].textContent=w+' × '+h+' '+ext.toUpperCase()+', '+bytes(blob.size)+(origSize?' ('+(diff>0?'+':'')+diff+'%)':'');
      el.stats.replaceChildren.apply(el.stats,d.childNodes);
      if(f!=='svg'&&EXT[blob.type]&&EXT[blob.type]!==(f==='jpeg'?'jpg':f))el.msg.textContent='This browser can’t export '+f.toUpperCase()+', so the file was saved as '+ext.toUpperCase()+'.';
    }
    if(f==='bmp'){done(encodeBMP(c));return}
    if(f==='svg'){
      var svg=el.mode.value==='trace'?traceSVG(c,w,h,solid):embedSVG(c,w,h);
      done(new Blob([svg],{type:'image/svg+xml'}));return;
    }
    c.toBlob(done,'image/'+f,(+el.q.value)/100);
  }

  function embedSVG(c,w,h){
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><image width="'+w+'" height="'+h+'" xlink:href="'+c.toDataURL('image/png')+'" href="'+c.toDataURL('image/png')+'"/></svg>';
  }

  function traceSVG(c,w,h,solid){
    var sc=Math.min(1,(+el.detail.value)/Math.max(w,h)),tw=Math.max(1,Math.round(w*sc)),th=Math.max(1,Math.round(h*sc));
    var t=document.createElement('canvas');t.width=tw;t.height=th;
    var tx=t.getContext('2d');tx.imageSmoothingQuality='high';tx.drawImage(c,0,0,tw,th);
    var d=tx.getImageData(0,0,tw,th).data,L=+el.lv.value,step=255/(L-1);
    var keys=new Int32Array(tw*th);
    for(var i=0;i<tw*th;i++){
      var a=d[i*4+3];
      if(a<128){keys[i]=-1;continue}
      var r=Math.round(Math.round(d[i*4]/step)*step),g=Math.round(Math.round(d[i*4+1]/step)*step),b=Math.round(Math.round(d[i*4+2]/step)*step);
      keys[i]=(r<<16)|(g<<8)|b;
    }
    var paths={},prev=new Map();
    function push(r){(paths[r.k]=paths[r.k]||[]).push('M'+r.x+' '+r.y+'h'+r.len+'v'+r.h+'h-'+r.len+'z')}
    for(var y=0;y<th;y++){
      var cur=new Map(),x=0;
      while(x<tw){
        var k=keys[y*tw+x];
        if(k<0){x++;continue}
        var s=x;while(x<tw&&keys[y*tw+x]===k)x++;
        var id=k+':'+s+':'+(x-s),r0=prev.get(id);
        if(r0){r0.h++;prev.delete(id)}else r0={k:k,x:s,y:y,len:x-s,h:1};
        cur.set(id,r0);
      }
      prev.forEach(push);prev=cur;
    }
    prev.forEach(push);
    var out='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+tw+' '+th+'" preserveAspectRatio="none" shape-rendering="crispEdges">';
    Object.keys(paths).forEach(function(k){
      var n=+k,hex='#'+[(n>>16)&255,(n>>8)&255,n&255].map(function(v){return v.toString(16).padStart(2,'0')}).join('');
      out+='<path fill="'+hex+'" d="'+paths[k].join('')+'"/>';
    });
    return out+'</svg>';
  }

  function encodeBMP(c){
    var w=c.width,h=c.height,d=c.getContext('2d').getImageData(0,0,w,h).data;
    var row=Math.ceil(w*3/4)*4,size=54+row*h,buf=new ArrayBuffer(size),v=new DataView(buf);
    v.setUint8(0,66);v.setUint8(1,77);v.setUint32(2,size,true);v.setUint32(10,54,true);
    v.setUint32(14,40,true);v.setInt32(18,w,true);v.setInt32(22,h,true);v.setUint16(26,1,true);v.setUint16(28,24,true);
    v.setUint32(34,row*h,true);v.setInt32(38,2835,true);v.setInt32(42,2835,true);
    var p=54;
    for(var y=h-1;y>=0;y--){
      var q=p;
      for(var x=0;x<w;x++){var i=(y*w+x)*4;v.setUint8(q++,d[i+2]);v.setUint8(q++,d[i+1]);v.setUint8(q++,d[i])}
      p+=row;
    }
    return new Blob([buf],{type:'image/bmp'});
  }

  /* events */
  el.file.addEventListener('change',function(){loadFile(el.file.files[0]);el.file.value=''});
  $('#another').addEventListener('click',function(){el.file.click()});
  el.dl.addEventListener('click',function(e){if(el.dl.getAttribute('aria-disabled')==='true')e.preventDefault()});
  document.addEventListener('dragover',function(e){e.preventDefault();el.drop.classList.add('over')});
  document.addEventListener('dragleave',function(){el.drop.classList.remove('over')});
  document.addEventListener('drop',function(e){e.preventDefault();el.drop.classList.remove('over');if(e.dataTransfer.files[0])loadFile(e.dataTransfer.files[0])});
  document.addEventListener('paste',function(e){
    var items=e.clipboardData&&e.clipboardData.files;if(items&&items[0])loadFile(items[0]);
  });
  document.querySelectorAll('input[name=fmt]').forEach(function(r){r.addEventListener('change',after)});
  el.w.addEventListener('input',function(){var r=ratioVal();if(r&&img)el.h.value=clamp(el.w.value/r);after()});
  el.h.addEventListener('input',function(){var r=ratioVal();if(r&&img)el.w.value=clamp(el.h.value*r);after()});
  el.ratio.addEventListener('change',function(){var r=ratioVal();if(r&&img)el.h.value=clamp(el.w.value/r);after()});
  document.querySelectorAll('[data-s]').forEach(function(b){
    b.addEventListener('click',function(){
      if(!img)return;
      var s=b.dataset.s/100,nw=clamp(srcW*s),r=ratioVal();
      el.w.value=nw;el.h.value=r?clamp(nw/r):clamp(srcH*s);after();
    });
  });
  [el.fit,el.q,el.bg,el.tr,el.mode,el.detail,el.lv].forEach(function(n){
    n.addEventListener('input',after);n.addEventListener('change',after);
  });
  syncUI();
})();
