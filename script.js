(function(){
  var $=function(s){return document.querySelector(s)};

  /* To add a tool by hand, copy one line below and change it. */
  var TOOLS=[
    {name:'QR Maker',desc:'Turn a link or text into a QR code you can download as PNG or SVG.',path:'qr-maker/index.html',icon:'qr',color:'#2B55E6'},
    {name:'Photo Edit',desc:'Convert JPG, PNG, WebP, BMP and SVG, then resize or change the aspect ratio.',path:'photo-edit/index.html',icon:'photo',color:'#D9480F'},
    {name:'File Converter',desc:'Convert PPTX, Word, PDF, Excel, Markdown and more to PDF, DOCX, HTML, TXT or Markdown.',path:'file-converter/index.html',icon:'file',color:'#0F766E'},
    {name:'Audio Edit',desc:'Trim an audio file on a waveform and export the clip.',path:'audio-edit/index.html',icon:'audio',color:'#7C3AED'}
  ];
  var ICONS={
    qr:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
    photo:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>',
    file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    audio:'<path d="M4 10v4M8 6v12M12 3v18M16 8v8M20 11v2"/>',
    tool:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><path d="M16.5 13v7M13 16.5h7"/>'
  };
  var KEY='my-tools-custom',custom=[];

  function load(){try{custom=JSON.parse(localStorage.getItem(KEY)||'[]')||[]}catch(e){custom=[]}}
  function store(){try{localStorage.setItem(KEY,JSON.stringify(custom))}catch(e){$('#msg').textContent='This browser couldn’t save your tool, so it will disappear when you reload.'}}

  function card(t,i){
    var el=document.createElement('article');el.className='card';el.style.setProperty('--c',t.color||'#2B55E6');
    var tile=document.createElement('div');tile.className='tile';
    tile.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+(ICONS[t.icon]||ICONS.tool)+'</svg>';
    var h=document.createElement('h2'),a=document.createElement('a');
    a.href=t.path;a.textContent=t.name;h.appendChild(a);
    var p=document.createElement('p');p.textContent=t.desc||'';
    var s=document.createElement('div');s.className='path';s.textContent=t.path;
    el.append(tile,h,p,s);
    if(i>=0){
      var b=document.createElement('button');b.className='rm';b.type='button';b.textContent='Remove';
      b.setAttribute('aria-label','Remove '+t.name);
      b.addEventListener('click',function(){custom.splice(i,1);store();render()});
      el.appendChild(b);
    }
    return el;
  }

  function render(){
    var q=$('#q').value.trim().toLowerCase(),g=$('#grid'),n=0;
    g.textContent='';
    TOOLS.map(function(t){return{t:t,i:-1}}).concat(custom.map(function(t,i){return{t:t,i:i}})).forEach(function(x){
      if(q&&(x.t.name+' '+(x.t.desc||'')).toLowerCase().indexOf(q)<0)return;
      g.appendChild(card(x.t,x.i));n++;
    });
    $('#none').hidden=n>0;
    var total=TOOLS.length+custom.length;
    $('#sub').textContent=total+(total===1?' tool':' tools')+', all running in your browser.';
  }

  $('#q').addEventListener('input',render);
  $('#form').addEventListener('submit',function(e){
    e.preventDefault();
    var n=$('#n').value.trim(),p=$('#p').value.trim(),d=$('#d').value.trim();
    if(/^\s*(javascript|data|vbscript):/i.test(p)){$('#msg').textContent='That path isn’t allowed. Use a folder or file path like my-tool/index.html.';return}
    if(!/\.html?$|\/$|^https?:/i.test(p))p=p.replace(/\/*$/,'/')+'index.html';
    custom.push({name:n,desc:d,path:p,icon:'tool',color:'#475569'});
    store();$('#form').reset();$('#msg').textContent='';render();
  });

  load();render();
})();