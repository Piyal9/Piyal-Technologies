(function(){
  var $=function(s){return document.querySelector(s)};
  var paper=$('#paper'),name='document',saved=null;
  var SIZES={a4:[210,297],letter:[215.9,279.4],legal:[215.9,355.6]};
  var PDFW='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  function msg(t){$('#msg').textContent=t||''}
  function stats(){var t=paper.innerText.trim();$('#count').textContent=(t?t.split(/\s+/).length:0)+' words, '+t.length+' characters'}
  function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  function need(n){if(!window[n])throw new Error('A converter library didn’t load. Check your internet connection and reload.')}
  function readAs(f,m){return new Promise(function(ok,no){var r=new FileReader();r.onload=function(){ok(r.result)};r.onerror=no;r[m](f)})}

  /* page setup */
  function dims(){
    var s=SIZES[$('#size').value],l=$('#orient').value==='landscape';
    return{w:l?s[1]:s[0],h:l?s[0]:s[1],m:Math.max(5,Math.min(50,+$('#margin').value||20)),fmt:$('#size').value,o:$('#orient').value};
  }
  function applyPage(){
    var d=dims();
    paper.style.width=d.w+'mm';paper.style.minHeight=d.h+'mm';paper.style.padding=d.m+'mm';
    paper.style.fontFamily=$('#ff').value;paper.style.fontSize=($('#fs').value||12)+'pt';
  }
  ['#size','#orient','#margin','#ff','#fs'].forEach(function(s){$(s).addEventListener('input',applyPage)});

  /* import */
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

  async function convert(f){
    var ext=(f.name.split('.').pop()||'').toLowerCase();
    if(f.type.indexOf('image/')===0)return '<p><img src="'+await readAs(f,'readAsDataURL')+'"></p>';
    if(ext==='txt'||ext==='log')return paras(await f.text());
    if(ext==='md'||ext==='markdown'){need('marked');return clean(marked.parse(await f.text()))}
    if(ext==='html'||ext==='htm')return clean(await f.text());
    if(ext==='docx'){need('mammoth');var r=await mammoth.convertToHtml({arrayBuffer:await f.arrayBuffer()});return clean(r.value)}
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
    throw new Error('.'+ext+' files aren’t supported. Save it as DOCX, PDF, TXT, HTML, Markdown, CSV, XLSX or an image first.');
  }

  async function load(files,append){
    files=[].slice.call(files);if(!files.length)return;
    var parts=[],errs=[];msg('Converting…');
    for(var i=0;i<files.length;i++){
      try{parts.push(await convert(files[i]))}catch(e){errs.push(files[i].name+': '+e.message)}
    }
    if(parts.length){
      var joined=parts.join('<hr>'),has=paper.textContent.trim()||paper.querySelector('img,table');
      paper.innerHTML=(append&&has)?paper.innerHTML+'<hr>'+joined:joined;
      if(!append||!has)name=files[0].name.replace(/\.[^.]+$/,'');
    }
    msg(errs.join(' '));stats();
  }
  $('#open').addEventListener('change',function(e){load(e.target.files,false);e.target.value=''});
  $('#add').addEventListener('change',function(e){load(e.target.files,true);e.target.value=''});
  $('#clear').addEventListener('click',function(){paper.innerHTML='';name='document';msg('');stats()});
  document.addEventListener('dragover',function(e){e.preventDefault()});
  document.addEventListener('drop',function(e){e.preventDefault();if(e.dataTransfer.files.length)load(e.dataTransfer.files,true)});

  /* editing */
  document.addEventListener('selectionchange',function(){
    var s=getSelection();
    if(s.rangeCount&&paper.contains(s.anchorNode))saved=s.getRangeAt(0).cloneRange();
    stats();
  });
  function run(c,v){
    paper.focus();
    if(saved){var s=getSelection();s.removeAllRanges();s.addRange(saved)}
    document.execCommand(c,false,v||null);stats();
  }
  var bar=$('#bar');
  bar.addEventListener('mousedown',function(e){if(e.target.closest('button'))e.preventDefault()});
  bar.addEventListener('click',function(e){var b=e.target.closest('[data-c]');if(b)run(b.dataset.c)});
  $('#block').addEventListener('change',function(e){run('formatBlock','<'+e.target.value+'>')});
  $('#fc').addEventListener('input',function(e){run('foreColor',e.target.value)});
  $('#hc').addEventListener('input',function(e){run('hiliteColor',e.target.value)});
  $('#link').addEventListener('click',function(){
    var u=prompt('Link address (https://…)');
    if(u&&!/^\s*(javascript|vbscript):/i.test(u))run('createLink',u);
  });
  $('#img').addEventListener('change',async function(e){
    var f=e.target.files[0];if(f)run('insertImage',await readAs(f,'readAsDataURL'));e.target.value='';
  });
  $('#tbl').addEventListener('click',function(){
    run('insertHTML','<table><tbody>'+('<tr>'+'<td><br></td>'.repeat(3)+'</tr>').repeat(3)+'</tbody></table><p><br></p>');
  });
  function cell(){var n=getSelection().anchorNode;return n&&(n.nodeType===1?n:n.parentElement).closest('td,th')}
  $('#rowp').addEventListener('click',function(){
    var c=cell();if(!c)return msg('Click inside a table cell first.');
    var r=c.parentElement,n=r.cloneNode(true);
    n.querySelectorAll('td,th').forEach(function(x){x.innerHTML='<br>'});r.after(n);msg('');
  });
  $('#colp').addEventListener('click',function(){
    var c=cell();if(!c)return msg('Click inside a table cell first.');
    var i=c.cellIndex;
    c.closest('table').querySelectorAll('tr').forEach(function(r){
      var x=r.cells[i];if(x){var y=x.cloneNode(false);y.innerHTML='<br>';x.after(y)}
    });msg('');
  });
  $('#rep').addEventListener('click',function(){
    var a=$('#find').value,b=$('#repl').value;if(!a)return;
    var w=document.createTreeWalker(paper,NodeFilter.SHOW_TEXT),n,list=[],c=0;
    while((n=w.nextNode()))list.push(n);
    list.forEach(function(t){if(t.nodeValue.indexOf(a)>-1){c+=t.nodeValue.split(a).length-1;t.nodeValue=t.nodeValue.split(a).join(b)}});
    msg(c?c+' replaced.':'No matches found.');stats();
  });
  paper.addEventListener('input',stats);

  /* export */
  function save(b,n){
    var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);
  }
  async function exportAs(x){
    if(!paper.textContent.trim()&&!paper.querySelector('img,table')){msg('Nothing to export yet. Open a file or type something.');return}
    var d=dims(),h=paper.innerHTML,n=name||'document',ff=paper.style.fontFamily,fs=paper.style.fontSize;
    msg('');
    var full='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+esc(n)+'</title><style>body{font-family:'+ff+';font-size:'+fs+';line-height:1.5}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}img{max-width:100%}</style></head><body>'+h+'</body></html>';
    try{
      if(x==='pdf'){
        need('html2pdf');
        var box=document.createElement('div');box.className='sheet';
        box.style.cssText='position:fixed;top:0;left:0;z-index:-1;background:#fff;color:#111;width:'+(d.w-2*d.m)+'mm';
        box.style.fontFamily=ff;box.style.fontSize=fs;box.innerHTML=h;document.body.appendChild(box);
        try{
          await html2pdf().set({margin:d.m,filename:n+'.pdf',image:{type:'jpeg',quality:.95},html2canvas:{scale:2,useCORS:true},
            jsPDF:{unit:'mm',format:d.fmt,orientation:d.o},pagebreak:{mode:['css','legacy'],avoid:['img','tr','h1','h2','h3']}}).from(box).save();
        }finally{box.remove()}
      }else if(x==='docx'){
        if(window.htmlDocx){
          var t=Math.round(d.m*56.7);
          save(htmlDocx.asBlob(full,{orientation:d.o,margins:{top:t,right:t,bottom:t,left:t}}),n+'.docx');
        }else{
          save(new Blob(['\ufeff',full],{type:'application/msword'}),n+'.doc');
          msg('The DOCX library didn’t load, so a Word-compatible .doc was saved instead.');
        }
      }else if(x==='html'){save(new Blob([full],{type:'text/html'}),n+'.html')}
      else if(x==='txt'){save(new Blob([paper.innerText],{type:'text/plain'}),n+'.txt')}
      else if(x==='md'){need('TurndownService');save(new Blob([new TurndownService({headingStyle:'atx'}).turndown(h)],{type:'text/markdown'}),n+'.md')}
    }catch(e){msg('Export failed: '+e.message)}
  }
  document.querySelectorAll('[data-x]').forEach(function(b){b.addEventListener('click',function(){exportAs(b.dataset.x)})});

  applyPage();stats();
})();
