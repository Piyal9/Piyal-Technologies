(function(){
  var $=function(s){return document.querySelector(s)};
  var files=[];
  var SIZES={a4:[210,297],letter:[215.9,279.4],legal:[215.9,355.6]};
  var PDFW='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var EXT={pdf:'pdf',docx:'docx',html:'html',txt:'txt',md:'md'};

  function msg(t,e){var m=$('#msg');m.textContent=t||'';m.className=e?'err':''}
  function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  function need(n){if(!window[n])throw new Error('A converter library didn’t load. Check your internet connection and reload.')}
  function readAs(f,m){return new Promise(function(ok,no){var r=new FileReader();r.onload=function(){ok(r.result)};r.onerror=no;r[m](f)})}
  function sz(b){return b>1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB'}
  function base(n){return n.replace(/\.[^.]+$/,'')}

  function clean(html){
    var d=new DOMParser().parseFromString(html,'text/html');
    d.querySelectorAll('script,iframe,object,embed,link,meta,style,base,form').forEach(function(n){n.remove()});
    d.body.querySelectorAll('*').forEach(function(n){
      [].slice.call(n.attributes).forEach(function(a){
        var v=a.value.trim().toLowerCase();
        if(/^on/i.test(a.name)||(/^(href|src|xlink:href|action)$/i.test(a.name)&&/^(javascript|vbscript):/.test(v)))n.removeAttribute(a.name);
      });
    });
    return d.body.innerHTML;
  }
  function paras(t){return t.split(/\n{2,}/).map(function(p){return '<p>'+esc(p).replace(/\n/g,'<br>')+'</p>'}).join('')}

  /* PPTX: text and images of each slide, one page per slide */
  var MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',svg:'image/svg+xml',webp:'image/webp',bmp:'image/bmp'};
  async function pptx(f){
    need('JSZip');
    var z=await JSZip.loadAsync(await f.arrayBuffer()),P=new DOMParser();
    var names=Object.keys(z.files).filter(function(n){return /^ppt\/slides\/slide\d+\.xml$/.test(n)})
      .sort(function(a,b){return +a.match(/(\d+)\.xml/)[1]-+b.match(/(\d+)\.xml/)[1]});
    if(!names.length)throw new Error('no slides found in this file.');
    var out='';
    for(var i=0;i<names.length;i++){
      var xml=P.parseFromString(await z.file(names[i]).async('string'),'application/xml');
      var rels={},rf=z.file(names[i].replace('slides/','slides/_rels/')+'.rels');
      if(rf){
        P.parseFromString(await rf.async('string'),'application/xml').querySelectorAll('Relationship').forEach(function(r){rels[r.getAttribute('Id')]=r.getAttribute('Target')});
      }
      var html='<section class="slide"><h2>Slide '+(i+1)+'</h2>';
      var all=xml.getElementsByTagName('*'),first=true;
      for(var k=0;k<all.length;k++){
        var el=all[k];
        if(el.localName==='p'&&el.namespaceURI.indexOf('drawingml')>-1){
          var t=[].slice.call(el.getElementsByTagName('*')).filter(function(x){return x.localName==='t'}).map(function(x){return x.textContent}).join('');
          if(t.trim())html+=(first?'<h3>':'<p>')+esc(t)+(first?'</h3>':'</p>'),first=false;
        }else if(el.localName==='blip'){
          var id=el.getAttribute('r:embed'),tg=rels[id];
          if(tg){
            var path='ppt/'+tg.replace(/^\.\.\//,''),mf=z.file(path),ex=path.split('.').pop().toLowerCase();
            if(mf&&MIME[ex])html+='<p><img src="data:'+MIME[ex]+';base64,'+await mf.async('base64')+'"></p>';
          }
        }
      }
      out+=html+'</section>';
    }
    return out;
  }

  async function toHtml(f){
    var ext=(f.name.split('.').pop()||'').toLowerCase();
    if(f.type.indexOf('image/')===0)return '<p><img src="'+await readAs(f,'readAsDataURL')+'"></p>';
    if(ext==='txt'||ext==='log')return paras(await f.text());
    if(ext==='md'||ext==='markdown'){need('marked');return clean(marked.parse(await f.text()))}
    if(ext==='html'||ext==='htm')return clean(await f.text());
    if(ext==='pptx')return pptx(f);
    if(ext==='docx'){need('mammoth');return clean((await mammoth.convertToHtml({arrayBuffer:await f.arrayBuffer()})).value)}
    if(['csv','tsv','xlsx','xls','ods'].indexOf(ext)>-1){
      need('XLSX');
      var wb=(ext==='csv'||ext==='tsv')?XLSX.read(await f.text(),{type:'string'}):XLSX.read(await f.arrayBuffer(),{type:'array'});
      return wb.SheetNames.map(function(n){return '<h3>'+esc(n)+'</h3>'+clean(XLSX.utils.sheet_to_html(wb.Sheets[n],{header:'',footer:''}))}).join('');
    }
    if(ext==='pdf'){
      need('pdfjsLib');pdfjsLib.GlobalWorkerOptions.workerSrc=PDFW;
      var pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise,out='';
      for(var i=1;i<=pdf.numPages;i++){
        var tc=await(await pdf.getPage(i)).getTextContent(),line='',y=null,lines=[];
        tc.items.forEach(function(it){
          var yy=Math.round(it.transform[5]);
          if(y!==null&&Math.abs(yy-y)>3){lines.push(line);line=''}
          line+=it.str;y=yy;
        });
        lines.push(line);
        out+=lines.filter(function(l){return l.trim()}).map(function(l){return '<p style="margin:0 0 .4em">'+esc(l)+'</p>'}).join('')+(i<pdf.numPages?'<hr>':'');
      }
      if(!out.replace(/<hr>/g,'').trim())throw new Error('no selectable text found (it may be a scanned PDF).');
      return out;
    }
    if(ext==='ppt'||ext==='doc')throw new Error('old .'+ext+' files aren’t supported. Save it as .'+ext+'x first.');
    throw new Error('.'+ext+' files aren’t supported.');
  }

  /* output */
  function dims(){
    var s=SIZES[$('#size').value],l=$('#orient').value==='landscape';
    return{w:l?s[1]:s[0],h:l?s[0]:s[1],m:Math.max(5,Math.min(50,+$('#margin').value||15)),fmt:$('#size').value,o:$('#orient').value};
  }
  async function fromHtml(h,x,n){
    var d=dims(),ff="Georgia,'Times New Roman',serif",fs='12pt';
    var full='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+esc(n)+'</title><style>body{font-family:'+ff+';font-size:'+fs+';line-height:1.5}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}img{max-width:100%}.slide{page-break-after:always}</style></head><body>'+h+'</body></html>';
    if(x==='html')return new Blob([full],{type:'text/html'});
    if(x==='md'){need('TurndownService');return new Blob([new TurndownService({headingStyle:'atx'}).turndown(h)],{type:'text/markdown'})}
    if(x==='docx'){
      need('htmlDocx');var t=Math.round(d.m*56.7);
      return htmlDocx.asBlob(full,{orientation:d.o,margins:{top:t,right:t,bottom:t,left:t}});
    }
    var box=document.createElement('div');box.className='sheet';
    box.style.cssText='position:fixed;top:0;left:0;z-index:-1;background:#fff;color:#111;width:'+(d.w-2*d.m)+'mm;font-family:'+ff+';font-size:'+fs;
    box.innerHTML=h;document.body.appendChild(box);
    try{
      if(x==='txt')return new Blob([box.innerText],{type:'text/plain'});
      need('html2pdf');
      return await html2pdf().set({margin:d.m,image:{type:'jpeg',quality:.95},html2canvas:{scale:2,useCORS:true},
        jsPDF:{unit:'mm',format:d.fmt,orientation:d.o},pagebreak:{mode:['css','legacy'],avoid:['img','tr','h1','h2','h3']}}).from(box).outputPdf('blob');
    }finally{box.remove()}
  }
  function save(b,n){
    var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);
  }

  async function go(){
    var x=$('#fmt').value,res=[],errs=[],btn=$('#go');
    btn.disabled=true;
    for(var i=0;i<files.length;i++){
      msg('Converting '+(i+1)+' of '+files.length+'…');
      try{
        var h=await toHtml(files[i]),n=base(files[i].name);
        res.push({blob:await fromHtml(h,x,n),name:n+'.'+EXT[x]});
      }catch(e){errs.push(files[i].name+': '+e.message)}
    }
    try{
      if(res.length===1)save(res[0].blob,res[0].name);
      else if(res.length>1){
        need('JSZip');var z=new JSZip(),seen={};
        res.forEach(function(r){var k=r.name;if(seen[k]){var p=k.lastIndexOf('.');k=k.slice(0,p)+' ('+seen[r.name]+')'+k.slice(p);seen[r.name]++}else seen[k]=1;z.file(k,r.blob)});
        save(await z.generateAsync({type:'blob'}),'converted.zip');
      }
    }catch(e){errs.push(e.message)}
    msg(errs.length?errs.join(' '):(res.length?'Done.':''),errs.length>0);
    btn.disabled=!files.length;
  }

  /* file list */
  function render(){
    var ul=$('#list');ul.innerHTML='';
    files.forEach(function(f,i){
      var li=document.createElement('li');
      li.innerHTML='<span class="n">'+esc(f.name)+'</span><span class="s">'+sz(f.size)+'</span>';
      var b=document.createElement('button');b.textContent='Remove';
      b.addEventListener('click',function(){files.splice(i,1);render()});
      li.appendChild(b);ul.appendChild(li);
    });
    $('#go').disabled=!files.length;
  }
  function add(fl){files=files.concat([].slice.call(fl));msg('');render()}
  $('#pick').addEventListener('change',function(e){add(e.target.files);e.target.value=''});
  $('#clear').addEventListener('click',function(){files=[];msg('');render()});
  $('#go').addEventListener('click',go);
  var dz=$('#drop');
  dz.addEventListener('dragover',function(e){e.preventDefault();dz.classList.add('over')});
  dz.addEventListener('dragleave',function(){dz.classList.remove('over')});
  dz.addEventListener('drop',function(e){e.preventDefault();dz.classList.remove('over');add(e.dataTransfer.files)});
  document.addEventListener('dragover',function(e){e.preventDefault()});
  document.addEventListener('drop',function(e){e.preventDefault()});
  render();
})();