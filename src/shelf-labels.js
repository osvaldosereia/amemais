// Etiquetas de gôndola AME+ Store: 80 mm, SKU por variação, Code 128 local/offline.
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
// Padrões oficiais Code 128 (valores 0..106), largura das barras/espaços em módulos.
const patterns=[
"212222","222122","222221","121223","121322","131222","122213","122312","132212",
"221213","221312","231212","112232","122132","122231","113222","123122","123221",
"223211","221132","221231","213212","223112","312131","311222","321122","321221",
"312212","322112","322211","212123","212321","232121","111323","131123","131321",
"112313","132113","132311","211313","231113","231311","112133","112331","132131",
"113123","113321","133121","313121","211331","231131","213113","213311","213131",
"311123","311321","331121","312113","312311","332111","314111","221411","431111",
"111224","111422","121124","121421","141122","141221","112214","112412","122114",
"122411","142112","142211","241211","221114","413111","241112","134111","111242",
"121142","121241","114212","124112","124211","411212","421112","421211","212141",
"214121","412121","111143","111341","131141","114113","114311","411113","411311",
"113141","114131","311141","411131","211412","211214","211232","2331112"
];
export function code128SVG(value){
 const code=String(value??'').trim();
 if(!code||!/^[\x20-\x7e]+$/.test(code))return '';
 const numeric=code.length%2===0&&/^\d+$/.test(code);
 // Evita barras estreitas demais nas impressoras térmicas de 203 dpi.
 if(code.length>(numeric?40:20))return '';
 const symbols=[numeric?105:104];
 if(numeric){
  for(let i=0;i<code.length;i+=2)symbols.push(Number(code.slice(i,i+2)));
 }else{
  for(let i=0;i<code.length;i++)symbols.push(code.charCodeAt(i)-32);
 }
 const checksum=symbols.reduce((sum,v,i)=>sum+(i===0?v:i*v),0)%103;
 symbols.push(checksum,106);
 const quiet=12, bars=[],widths=symbols.map(x=>patterns[x]);
 let x=quiet;
 for(const p of widths){
  for(let j=0;j<p.length;j++){
   const width=Number(p[j]);
   if(j%2===0)bars.push('<rect x="'+x+'" y="0" width="'+width+'" height="48"/>');
   x+=width;
  }
 }
 const total=x+quiet;
 return '<svg class="shelf-barcode" xmlns="http://www.w3.org/2000/svg" width="72mm" height="18mm" viewBox="0 0 '+
  total+' 48" preserveAspectRatio="none" fill="#000" shape-rendering="crispEdges" role="img" aria-label="Código de barras Code 128: '+
  escapeHtml(code)+'">'+bars.join('')+'</svg>';
}
export function shelfLabelData(product,modelName=''){
 const name=String(modelName||product?.name||'Produto').trim();
 const raw=String(product?.gondola||'').trim();
 const gondola=raw.replace(/^g[oô]ndola\s*/i,'').trim()||raw;
 const shelf=String(product?.prateleira||'').trim().replace(/^prateleira\s*/i,'');
 const color=String(product?.apparel_color||'').trim();
 const size=String(product?.apparel_size||'').trim();
 const ean=String(product?.ean||'').trim();
 const sku=String(product?.sku||'').trim();
 const scanned=ean||sku;
 return {id:product?.id||'',name,gondola,shelf,color,size,ean,sku,scanned,
  valid:Boolean(gondola&&code128SVG(scanned))};
}
export function shelfLabelArticle(item){
 const barcode=code128SVG(item.scanned);
 const variant=[item.color&&item.color!=='Única'?item.color:'',item.size&&item.size!=='Única'?item.size:'']
  .filter(Boolean).join(' · ');
 return '<article class="shelf-label">'+
 '<div class="shelf-label-heading"><strong>AME<span>+</span> STORE</strong><small>ESTOQUE · CDSB</small></div>'+
 '<div class="shelf-label-place"><div><span>LOCALIZAÇÃO</span><strong>GÔNDOLA '+escapeHtml(item.gondola||'—')+'</strong></div>'+
 (item.shelf?'<div class="shelf-label-shelf"><span>PRATELEIRA</span><strong>'+escapeHtml(item.shelf)+'</strong></div>':'')+'</div>'+
 '<div class="shelf-label-product"><strong>'+escapeHtml(item.name)+'</strong>'+
 (variant?'<span>'+escapeHtml(variant)+'</span>':'')+'</div>'+
 '<div class="shelf-label-identifiers"><div><span>SKU</span><strong>'+escapeHtml(item.sku||'—')+'</strong></div>'+ 
 '<div><span>EAN</span><strong>'+escapeHtml(item.ean||'—')+'</strong></div></div>'+
 (barcode?'<div class="shelf-label-code">'+barcode+
  '<strong>'+escapeHtml(item.scanned)+'</strong></div>':
  '<div class="shelf-label-no-code">SEM EAN / SKU VÁLIDO</div>')+
 '<div class="shelf-label-footer"><span>SKU: '+escapeHtml(item.sku||'—')+'</span>'+
 '<span>'+escapeHtml(item.ean?'EAN / CODE 128':'CÓDIGO INTERNO / CODE 128')+'</span></div>'+
 '</article>';
}
export function shelfLabelPicker(products,modelName=''){
 const items=products.map(p=>shelfLabelData(p,modelName));
 return '<div class="shelf-label-picker">'+
 '<p>Escolha os tamanhos e a quantidade de etiquetas para cada variação. Cada etiqueta terá seu próprio código de barras e a gôndola cadastrada.</p>'+
 '<div class="shelf-label-preview-title">Prévia da etiqueta (bobina de 80 mm)</div>'+
 '<div class="shelf-label-preview">'+(items.length?shelfLabelArticle(items.find(x=>x.valid)||items[0]):'Nenhum produto cadastrado.')+'</div>'+
 '<div class="shelf-label-variant-head"><strong>Etiquetas a imprimir</strong><small>1 por variação, por padrão</small></div>'+
 '<div class="shelf-label-variants">'+items.map((x,i)=>{
  const eligible=Boolean(products[i]?.active)&&x.valid;
  const reason=!x.gondola?'Cadastre a gôndola antes de imprimir':
   !code128SVG(x.scanned)?'Cadastre um EAN ou SKU válido':
   !products[i]?.active?'Variação inativa':'';
  return '<div class="shelf-label-option'+(!eligible?' unavailable':'')+'">'+
   '<label><input type="checkbox" data-shelf-label-id="'+escapeHtml(x.id)+'" '+
    (eligible?'checked':'disabled')+'>'+
    '<span><strong>'+escapeHtml([x.color,x.size].filter(v=>v&&v!=='Única').join(' · ')||x.name)+'</strong>'+
     '<small>Gôndola '+escapeHtml(x.gondola||'—')+
      (x.shelf?' · Prateleira '+escapeHtml(x.shelf):'')+
      ' · EAN '+escapeHtml(x.ean||'—')+'</small>'+
     (reason?'<small class="shelf-label-warning">'+escapeHtml(reason)+'</small>':'')+'</span></label>'+
    '<label class="shelf-label-copies">Cópias<input type="number" data-shelf-label-copies="'+escapeHtml(x.id)+
      '" min="1" max="20" step="1" inputmode="numeric" value="1" '+(!eligible?'disabled':'')+'></label>'+
  '</div>';
 }).join('')+'</div>'+
 '<p class="shelf-label-help">Formato de impressão: <b>80 mm de largura × 70 mm por etiqueta</b> (até 40 por impressão), sem fotos, preço ou quantidade em estoque. Não confundir o código impresso com o código do pedido.</p>'+
 '</div>';
}
export function collectShelfLabels(products,form,modelName=''){
 const mapping=new Map(products.map(p=>[String(p.id),shelfLabelData(p,modelName)]));
 const output=[];
 for(const field of form.querySelectorAll('[data-shelf-label-id]:checked')){
  const item=mapping.get(field.dataset.shelfLabelId);
  if(!item?.valid)throw Error('Variação sem EAN/SKU ou gôndola. Atualize o cadastro.');
  const copiesRaw=form.querySelector('[data-shelf-label-copies="'+item.id+'"]')?.value||'1';
  if(!/^(?:[1-9]|1\d|20)$/.test(copiesRaw))throw Error('Informe de 1 a 20 cópias por variação.');
  for(let n=0;n<Number(copiesRaw);n++){
   if(output.length>=40)throw Error('Limite de 40 etiquetas por impressão.');
   output.push(item);
  }
 }
 if(!output.length)throw Error('Selecione ao menos uma variação com gôndola e EAN/SKU cadastrado.');
 return output;
}
export function shelfLabelsHTML(items){
 if(!Array.isArray(items)||!items.length||items.length>40)
  throw Error('Selecione de 1 a 40 etiquetas.');
 if(items.some(item=>!item?.valid))throw Error('Etiqueta sem gôndola ou código válido.');
 const css=[
 '<style>',
 '@page{margin:0}',
 '*{box-sizing:border-box}',
 'html,body{padding:0;margin:0;background:white;color:black}',
 'body{font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
 '.label-sheet{width:80mm;max-width:80mm;margin:0 auto}',
 '.shelf-label{height:70mm;width:80mm;max-width:80mm;padding:2mm 4mm 1.5mm;',
 'display:flex;flex-direction:column;gap:.75mm;border-bottom:1px dashed #888;',
 'page-break-inside:avoid;break-inside:avoid;overflow:hidden}',
 '.shelf-label-heading{display:flex;justify-content:space-between;align-items:center}',
 '.shelf-label-heading strong{font-size:9pt;letter-spacing:.05px}',
 '.shelf-label-heading strong span{font-weight:900}',
 '.shelf-label-heading small{font-size:5.5pt;letter-spacing:0}',
 '.shelf-label-place{display:flex;align-items:center;justify-content:space-between;',
 'gap:1mm;border-top:1.2px solid black;border-bottom:1.2px solid black;padding:.7mm 0}',
 '.shelf-label-place>div{display:flex;flex-direction:column;gap:.5mm}',
 '.shelf-label-place span{font-size:6.3pt;font-weight:700}',
 '.shelf-label-place>div>strong{font-size:15pt;font-weight:900;line-height:1.1;overflow-wrap:anywhere}',
 '.shelf-label-shelf{text-align:right;min-width:12mm}',
 '.shelf-label-shelf strong{font-size:12pt!important}',
 '.shelf-label-product{display:flex;flex-direction:column;min-height:11mm;gap:.7mm}',
 '.shelf-label-product strong{font-size:13pt;font-weight:900;line-height:1.12;',
 'overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
 '.shelf-label-product span{font-size:10pt;font-weight:800}',
 '.shelf-label-identifiers{display:flex;flex-direction:column;gap:.65mm;padding:.65mm 0;border-top:1px solid #222}',
 '.shelf-label-identifiers>div{display:flex;align-items:baseline;gap:2mm;min-width:0}',
 '.shelf-label-identifiers span{font-size:7.5pt;font-weight:800;min-width:7mm}',
 '.shelf-label-identifiers strong{font-size:10pt;font-weight:850;overflow-wrap:anywhere}',
 '.shelf-label-code{display:flex;align-items:center;justify-content:center;flex-direction:column;',
 'margin-top:auto;gap:.4mm}',
 '.shelf-barcode{width:72mm;height:18mm;max-width:100%;display:block}',
 '.shelf-label-code>strong{font-family:monospace;font-size:9pt;font-weight:800;letter-spacing:.1px;overflow-wrap:anywhere}',
 '.shelf-label-no-code{text-align:center;font-size:8pt}',
 '.shelf-label-footer{border-top:1px solid #000;display:flex;align-items:center;',
 'justify-content:space-between;gap:1mm;font-size:5.5pt;font-weight:700;padding-top:.5mm}',
 '.label-screen-actions{display:flex;justify-content:center;gap:8px;margin:10px auto;',
 'font-size:14px}.label-screen-actions button{padding:10px;border:1px solid #555;background:#fff;cursor:pointer}',
 '@media screen{html{background:#dadada}body{background:transparent}',
 ' .shelf-label{background:white;box-shadow:0 2px 8px #0002;margin-bottom:5px}}',
 '@media print{html,body{width:80mm!important;max-width:80mm!important;overflow:visible!important}',
 ' .label-screen-actions{display:none!important}.label-sheet{margin:0!important}',
 ' .shelf-label{border-bottom:1px dashed #888;box-shadow:none!important;margin:0!important}}',
 '</style>'
 ].join('');
 const script=[
 '<script>',
 'window.printLabels80=()=>{',
 'const sheet=document.querySelector(".label-sheet");if(!sheet)return;',
 'const mm=sheet.querySelectorAll(".shelf-label").length*70+2;',
 'let tag=document.getElementById("shelf-page-size");',
 'if(!tag){tag=document.createElement("style");tag.id="shelf-page-size";document.head.append(tag);}',
 'tag.textContent="@page{size:80mm "+Math.max(70,Math.min(3000,mm))+"mm;margin:0}";',
 'window.focus();window.print();',
 '};',
 'window.addEventListener("load",()=>window.printLabels80());',
 '</script>'
 ].join('');
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
 '<title>Etiquetas de gôndola · '+items.length+' un.</title>'+
 '<meta name="viewport" content="width=device-width, initial-scale=1">'+css+'</head><body>'+
 '<div class="label-screen-actions"><button onclick="window.printLabels80()">Imprimir etiquetas 80 mm</button>'+
 '<button onclick="window.close()">Fechar</button></div>'+
 '<main class="label-sheet">'+items.map(shelfLabelArticle).join('')+'</main>'+script+'</body></html>';
}
