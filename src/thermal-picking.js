// Cupom contínuo de separação para bobina térmica de 80 mm.
// Ordenação por gôndola, prateleira, modelo e variação.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Number(value||0).toLocaleString('pt-BR');

export function groupedThermalPickingLines(lines=[]){
 const groups=new Map(),unlocated=[];
 const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
 for(const line of lines){
  if(!(Number(line.quantity)>0))continue;
  const text=String(line.gondola??'').trim();
  if(!text){unlocated.push(line);continue;}
  const location=text.replace(/^g[oô]ndola\s*/i,'').trim()||text;
  // Gôndola 03 e gôndola 3 representam o mesmo endereço físico.
  const key=/^\d+$/.test(location)?String(Number(location)):location;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(line);
 }
 const sorted=rows=>rows.sort((a,b)=>
  collator.compare(String(a.prateleira||''),String(b.prateleira||''))||
  collator.compare(String(a.modelTitle||a.name||''),String(b.modelTitle||b.name||''))||
  collator.compare(String(a.color||''),String(b.color||''))||
  collator.compare(String(a.size||''),String(b.size||''))||
  collator.compare(String(a.sku||''),String(b.sku||'')));
 const output=[...groups].sort((a,b)=>collator.compare(a[0],b[0]))
  .map(([key,rows])=>({key,title:'GÔNDOLA '+key,lines:sorted(rows)}));
 if(unlocated.length)output.push({key:'',title:'SEM GÔNDOLA CADASTRADA',lines:sorted(unlocated)});
 return output.map(g=>({...g,units:g.lines.reduce((sum,line)=>sum+Number(line.quantity||0),0)}));
}

export function pickingThermalHTML(order,{printedAt='',brand='AME+ STORE',photoUrls={}}={}){
 const locations=groupedThermalPickingLines(order.lines||[]);
 const markup=locations.map(group=>
  '<section class="gondola-group"><h2>'+esc(group.title)+
  '<small>'+fmt(group.units)+' un. · '+group.lines.length+' SKU(s)</small></h2>'+
  group.lines.map(line=>{
    const photo=line.imagePath&&photoUrls[line.imagePath];
    const variant=[line.color,line.size].filter(x=>x&&x!=='Única').join(' · ');
    return '<article class="pick-item">'+
      '<div class="pick-main"><div class="pick-photo">'+(photo?
       '<img src="'+esc(photo)+'" alt="Foto: '+esc(line.modelTitle||line.name)+'">':
       '<span>SEM FOTO</span>')+'</div>'+
      '<div class="pick-info"><div class="pick-name">'+esc(line.modelTitle||line.name||'Produto')+'</div>'+
        (variant?'<div class="pick-variant">'+esc(variant)+'</div>':'')+
        '<div class="pick-code">CÓD. '+esc(line.sku||'—')+'</div>'+
        '<div class="pick-ean">EAN '+esc(line.ean||'—')+'</div>'+
        (line.prateleira?'<div class="pick-shelf">PRATELEIRA '+esc(line.prateleira)+'</div>':'')+
      '</div></div>'+
      '<div class="pick-quantity"><strong>SEPARAR <b>'+fmt(line.quantity)+'</b> UN.</strong>'+
       '<span>CONFERIDO: <i aria-hidden="true"></i> ____</span></div>'+
    '</article>';
  }).join('')+'</section>').join('');
 const code=String(order.code||'—');
 const title=order.kind==='evento'?'LOTE':'PEDIDO';
 const units=locations.reduce((sum,group)=>sum+group.units,0);
 const skuCount=locations.reduce((sum,group)=>sum+group.lines.length,0);
 const css=[
 '<style>',
 '@page{margin:0}',
 '*{box-sizing:border-box}',
 'html,body{padding:0;margin:0;background:#fff;color:#000}',
 'body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
 '.slip{width:72mm;max-width:72mm;margin:0 auto;padding:2mm 0 3mm;overflow-wrap:anywhere}',
 '.brand{text-align:center;font-size:14pt;font-weight:900;letter-spacing:.4px}',
 'h1{text-align:center;font-size:12pt;line-height:1.25;margin:2mm 0}',
 '.meta{font-size:9pt;line-height:1.4;border-block:1px dashed #000;padding:2mm 0}',
 '.meta strong{font-size:10pt}.meta div{margin:1mm 0}',
 '.summary{margin:2.5mm 0;font-size:10pt;font-weight:800;text-align:center}',
 '.gondola-group{margin:3mm 0 0}',
 'h2{font-size:13pt;line-height:1.15;border-top:2px solid #000;border-bottom:2px solid #000;padding:2mm 0 1.5mm;margin:0 0 1.2mm;font-weight:900}',
 'h2 small{display:block;font-size:8pt;margin-top:1mm;font-weight:700}',
 '.pick-item{padding:2mm 0;border-bottom:1px dashed #555;break-inside:avoid;page-break-inside:avoid}',
 '.pick-main{display:flex;align-items:flex-start;gap:2mm;min-width:0}',
 '.pick-photo{width:22mm;height:24mm;flex:0 0 22mm;border:1px solid #444;display:flex;align-items:center;justify-content:center;overflow:hidden}',
 '.pick-photo img{display:block;width:100%;height:100%;object-fit:contain;filter:grayscale(100%) contrast(1.15)}',
 '.pick-photo span{font-size:8pt;text-align:center}',
 '.pick-info{min-width:0;flex:1;font-size:9pt;line-height:1.3}',
 '.pick-name{font-size:10pt;line-height:1.2;font-weight:900;margin-bottom:1mm}',
 '.pick-variant{font-size:9pt;font-weight:800;margin-bottom:1mm}',
 '.pick-code,.pick-ean{font-size:8.5pt;overflow-wrap:anywhere;word-break:break-word}',
 '.pick-shelf{font-size:9pt;font-weight:900;margin-top:1mm}',
 '.pick-quantity{display:flex;align-items:center;justify-content:space-between;gap:2mm;padding-top:2mm;font-size:8pt}',
 '.pick-quantity strong{font-size:9pt;white-space:nowrap}',
 '.pick-quantity b{font-size:15pt;font-weight:900}',
 '.pick-quantity span{font-size:7pt;white-space:nowrap}',
 '.pick-quantity i{display:inline-block;width:3.5mm;height:3.5mm;border:1.3px solid #000;vertical-align:middle}',
 'footer{border-top:2px solid #000;margin-top:3mm;padding-top:2mm;font-size:8pt;line-height:1.5}',
 '.signature{margin:6mm 0 2mm;border-top:1px solid #000;text-align:center;padding-top:1mm}',
 '.screen-actions{width:72mm;max-width:72mm;margin:0 auto 3mm;padding:4mm;display:flex;gap:2mm;justify-content:center}',
 '.screen-actions button{border:1px solid #222;background:white;padding:3mm;font-size:10pt;cursor:pointer}',
 '@media screen{html{background:#ddd}body{width:80mm;margin:10px auto;box-shadow:0 1px 12px #888}}',
 '@media print{html,body{width:80mm!important;max-width:80mm!important;margin:0!important;box-shadow:none!important}',
 ' .slip{width:72mm!important;max-width:72mm!important;margin:0 auto!important}',
 ' .screen-actions{display:none!important}h2,.pick-item{break-inside:avoid;page-break-inside:avoid}}',
 '</style>'
 ].join('');
 const autoPrint=[
 '<script>',
 'window.printSlip80=()=>{',
 'const slip=document.querySelector(".slip");',
 'if(!slip)return;',
 'const heightMM=Math.ceil(slip.getBoundingClientRect().height*25.4/96+5);',
 'let page=document.getElementById("thermal-page-size");',
 'if(!page){page=document.createElement("style");page.id="thermal-page-size";document.head.append(page);}',
 'page.textContent="@page{size:80mm "+Math.min(3000,Math.max(40,heightMM))+"mm;margin:0}";',
 'window.focus();window.print();',
 '};',
 'window.addEventListener("load",async()=>{',
 'const pending=Array.from(document.images,img=>img.complete?Promise.resolve():new Promise(resolve=>{',
 'img.addEventListener("load",resolve,{once:true});img.addEventListener("error",resolve,{once:true});}));',
 'await Promise.race([Promise.all(pending),new Promise(resolve=>setTimeout(resolve,7000))]);',
 'window.printSlip80();',
 '});',
 '</script>'
 ].join('');
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width, initial-scale=1">'+
 '<title>Separação térmica '+esc(title)+' #'+esc(code)+'</title>'+css+'</head><body>'+
 '<div class="screen-actions"><button onclick="window.printSlip80()">Imprimir bobina 80 mm</button>'+
 '<button onclick="window.close()">Fechar</button></div>'+
 '<main class="slip"><header><div class="brand">'+esc(brand)+'</div>'+
  '<h1>LISTA DE SEPARAÇÃO</h1></header>'+
 '<div class="meta"><div><strong>'+esc(title)+' #'+esc(code)+'</strong></div>'+
 '<div><b>DESTINO:</b> '+esc(order.target||'—')+'</div>'+
 '<div><b>ORIGEM:</b> '+esc(order.origin||'—')+'</div>'+
 '<div><b>IMPRESSO:</b> '+esc(printedAt)+'</div></div>'+
 '<div class="summary">'+skuCount+' SKU(s) · '+fmt(units)+' unidades · '+locations.length+' local(is)</div>'+
 markup+
 '<footer><strong>TOTAL: '+fmt(units)+' UNIDADES</strong>'+
 '<div>Pedido: '+esc(code)+'</div>'+
 '<div>Observações: __________________________</div>'+
 '<div class="signature">Separador / conferente</div></footer>'+
 '</main>'+autoPrint+'</body></html>';
}
