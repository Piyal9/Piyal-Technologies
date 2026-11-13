(function(){
  var $=function(s){return document.querySelector(s)};
  var cv=$('#cv'),ctx=cv.getContext('2d'),last=null,name='qr-code';

  function msg(t,ok){var m=$('#msg');m.textContent=t||'';m.className=ok?'ok':''}
  function normalize(t){
    t=t.trim();
    if(t&&!/^[a-z][a-z0-9+.-]*:/i.test(t)&&/^[^\s@]+\.[a-z]{2,}([\/?#]\S*)?$/i.test(t))return 'https://'+t;
    return t;
  }
  function lum(h){
    var c=[1,3,5].map(function(i){return parseInt(h.substr(i,2),16)/255}).map(function(v){return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});
    return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
  }
  function ratio(a,b){var x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)}
  function buttons(on){['#png','#svg','#copy'].forEach(function(s){$(s).disabled=!on})}

  function build(){
    $('#sv').textContent=$('#size').value;
    $('#mv').textContent=$('#margin').value;
    var t=normalize($('#text').value);
    if(!t){
      last=null;cv.hidden=true;$('#empty').hidden=false;$('#info').textContent='';msg('');buttons(false);return;
    }
    var qr;
    try{
      if(!window.qrcode)throw new Error('lib');
      if(qrcode.stringToBytesFuncs&&qrcode.stringToBytesFuncs['UTF-8'])qrcode.stringToBytes=qrcode.stringToBytesFuncs['UTF-8'];
      qr=qrcode(0,$('#ec').value);qr.addData(t);qr.make();
    }catch(e){
      last=null;cv.hidden=true;$('#empty').hidden=false;$('#empty').textContent='No QR code to show.';buttons(false);
      msg(e.message==='lib'?'The QR library didn’t load. Check your internet connection and reload.'
        :'That’s too much text for a QR code. Shorten it or lower the error correction level.');
      return;
    }
    var fg=$('#fg').value,bg=$('#bg').value,n=qr.getModuleCount(),m=+$('#margin').value,total=n+2*m;
    var cell=Math.max(1,Math.floor(+$('#size').value/total)),px=cell*total;
    cv.width=cv.height=px;
    ctx.fillStyle=bg;ctx.fillRect(0,0,px,px);ctx.fillStyle=fg;
    for(var r=0;r<n;r++)for(var c=0;c<n;c++)if(qr.isDark(r,c))ctx.fillRect((c+m)*cell,(r+m)*cell,cell,cell);
    last={qr:qr,n:n,m:m,px:px,fg:fg,bg:bg};
    cv.hidden=false;$('#empty').hidden=true;$('#empty').textContent='Type a link to see your QR code.';
    $('#info').textContent='Encodes: '+t+'. Image size: '+px+' × '+px+' px.';
    try{name='qr-'+new URL(t).hostname.replace(/[^a-z0-9.-]/gi,'')}catch(e){name='qr-code'}
    buttons(true);
    msg(ratio(fg,bg)<3?'Low contrast: use a darker code on a lighter background so phones can scan it.':'');
  }

  function svgText(){
    var s=last,t=s.n+2*s.m,d='';
    for(var r=0;r<s.n;r++){
      var c=0;
      while(c<s.n){
        if(s.qr.isDark(r,c)){var st=c;while(c<s.n&&s.qr.isDark(r,c))c++;d+='M'+(st+s.m)+' '+(r+s.m)+'h'+(c-st)+'v1h-'+(c-st)+'z'}
        else c++;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+t+' '+t+'" width="'+s.px+'" height="'+s.px+'" shape-rendering="crispEdges"><rect width="'+t+'" height="'+t+'" fill="'+s.bg+'"/><path fill="'+s.fg+'" d="'+d+'"/></svg>';
  }
  function save(b,n){
    var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);
  }

  $('#png').addEventListener('click',function(){if(last)cv.toBlob(function(b){save(b,name+'.png')},'image/png')});
  $('#svg').addEventListener('click',function(){if(last)save(new Blob([svgText()],{type:'image/svg+xml'}),name+'.svg')});
  $('#copy').addEventListener('click',function(){
    if(!last)return;
    cv.toBlob(async function(b){
      try{await navigator.clipboard.write([new ClipboardItem({'image/png':b})]);msg('Copied to the clipboard.',true)}
      catch(e){msg('Your browser blocked copying. Use Download PNG instead.')}
    },'image/png');
  });
  ['#text','#size','#margin','#ec','#fg','#bg'].forEach(function(s){
    $(s).addEventListener('input',build);$(s).addEventListener('change',build);
  });
  build();
})();
