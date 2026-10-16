// Download real de PDF A4, sem abrir janela de impressão.
// jsPDF roda no navegador e gera um Blob PDF para desktop e Android.
const format=n=>Number(n||0).toLocaleString('pt-BR');
const localDate=value=>value?new Date(String(value).length===10?value+'T12:00:00':value).toLocaleDateString('pt-BR'):'A definir';
const modelKey=p=>p?.apparel_model_id?'model:'+p.apparel_model_id:'product:'+p?.id;

export function groupPurchaseItems(items,products=[],models=[]){
 const catalog=new Map(products.map(p=>[p.id,p]));
 const groups=new Map();
 for(const item of items){
  const p=catalog.get(item.product_id),model=models.find(m=>m.id===p?.apparel_model_id);
  const key=modelKey(p)||'unknown:'+item.id;
  if(!groups.has(key))groups.set(key,{name:model?.name||p?.name||item.product_name,
   imagePath:model?.image_path||p?.image_path||null,rows:[]});
  groups.get(key).rows.push({...item,color:p?.apparel_color||'',size:p?.apparel_size||''});
 }
 return [...groups.values()];
}
function pdfFilename(order){
 return 'CDSB-Pedido-de-Compra-'+String(order.number).padStart(5,'0')+'.pdf';
}
async function imageJPEG(src){
 if(!src)return null;
 try{
  const response=await fetch(src,{credentials:'omit'});
  if(!response.ok)throw new Error('Foto indisponível');
  const blob=await response.blob();
  const bitmap=await createImageBitmap(blob);
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,480/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg',.79);
 }catch(error){
  console.warn('Foto indisponível para PDF',error);
  return null;
 }
}
export async function createPurchasePDF(order,supplier,items,{products=[],models=[],photoUrls={},jsPDFClass=null}={}){
 if(!order||!supplier||!items?.length)throw new Error('Pedido incompleto para PDF');
 const JsPDF=jsPDFClass||(await import('https://esm.sh/jspdf@2.5.2')).jsPDF;
 if(!JsPDF)throw new Error('Biblioteca de PDF indisponível. Verifique a conexão.');
 const pdf=new JsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
 const groups=groupPurchaseItems(items,products,models);
 const images=new Map();
 await Promise.all(groups.map(async g=>{
  const url=photoUrls[g.imagePath];
  if(url)images.set(g.imagePath,await imageJPEG(url));
 }));
 const ink=[16,45,80],gold=[199,163,95],muted=[94,110,131],left=13,right=197;
 let y=18,page=1;
 const setText=(r=16,g=45,b=80)=>pdf.setTextColor(r,g,b);
 const line=(at)=>{pdf.setDrawColor(...gold);pdf.line(left,at,right,at);};
 const pageFoot=()=>{pdf.setFontSize(8);setText(...muted);
  pdf.text('CDSB | Compra não representa entrada em estoque',left,290);
  pdf.text('Página '+page,right,290,{align:'right'});
 };
 function startPage(){
  if(page>1){pageFoot();pdf.addPage();y=18;}
  setText(...ink);pdf.setFont('helvetica','bold');pdf.setFontSize(16);
  pdf.text('CDSB | PEDIDO DE COMPRA',left,y);y+=7;
  setText(...gold);pdf.setFontSize(12);
  pdf.text('PC-'+String(order.number).padStart(5,'0'),left,y);
  setText(...muted);pdf.setFontSize(9);
  pdf.text('Emissão '+localDate(order.created_at),right,y,{align:'right'});y+=6;
  line(y);y+=9;
 }
 function ensure(height){if(y+height>278){page++;startPage();}}
 startPage();
 pdf.setFontSize(10);setText(...ink);
 pdf.setFont('helvetica','bold');pdf.text('FORNECEDOR',left,y);y+=6;
 pdf.setFont('helvetica','normal');
 pdf.text(String(supplier.name).slice(0,94),left,y);y+=6;
 const detail=[supplier.contact_name,supplier.phone,supplier.email].filter(Boolean).join('  |  ');
 if(detail){pdf.setFontSize(8.5);setText(...muted);
  const lines=pdf.splitTextToSize(detail,182);
  pdf.text(lines,left,y);y+=lines.length*4.6+3;}
 setText(...ink);pdf.setFontSize(9);
 pdf.text('Prazo estimado: '+(order.estimated_days||'—')+' dias corridos',left,y);
 pdf.text('Previsão de chegada: '+localDate(order.expected_arrival_date),right,y,{align:'right'});y+=8;
 line(y);y+=8;
 const total=items.reduce((n,it)=>n+Number(it.quantity||0),0);
 pdf.setFont('helvetica','bold');pdf.setFontSize(10);
 pdf.text(groups.length+' modelo(s)  |  '+items.length+' SKU(s)  |  '+format(total)+' unidade(s)',left,y);
 y+=10;
 for(const [i,g] of groups.entries()){
  const maxText=pdf.splitTextToSize(g.name||'Produto',145);
  const blockH=Math.max(38,15+g.rows.length*7.8+maxText.length*4);
  ensure(blockH+5);
  const top=y;
  pdf.setFillColor(244,247,251);pdf.roundedRect(left,top,184,blockH,2,2,'F');
  const photo=images.get(g.imagePath);
  if(photo){try{pdf.addImage(photo,'JPEG',left+3,top+4,27,27);}catch(e){console.warn('Erro ao inserir foto',e);}}
  else{pdf.setDrawColor(218,226,238);pdf.rect(left+3,top+4,27,27);
   pdf.setFont('helvetica','normal');pdf.setFontSize(7);setText(...muted);
   pdf.text('Sem foto',left+16.5,top+18,{align:'center'});}
  const px=left+34, tx=px+124;
  setText(...ink);pdf.setFont('helvetica','bold');pdf.setFontSize(9.5);
  const display=pdf.splitTextToSize(g.name||'Produto',125);
  pdf.text(display,px,top+6);let iy=top+7+display.length*4.3;
  pdf.setFontSize(8.5);
  for(const row of g.rows){
   pdf.setFont('helvetica','normal');setText(...muted);
   const variant=[row.color&&row.color!=='Única'?row.color:'',row.size].filter(Boolean).join(' · ');
   const label=(variant||'Único')+'  |  SKU '+(row.sku||'—');
   pdf.text(pdf.splitTextToSize(label,122)[0],px,iy);
   pdf.setFont('helvetica','bold');setText(...ink);
   pdf.text(format(row.quantity)+' un.',right-4,iy,{align:'right'});
   iy+=7.8;
  }
  y=top+Math.max(26,blockH)+5;
 }
 ensure(22);
 if(order.note){
  pdf.setFont('helvetica','bold');setText(...ink);pdf.setFontSize(9);pdf.text('OBSERVAÇÕES',left,y);y+=5;
  const note=pdf.splitTextToSize(String(order.note),180);
  ensure(note.length*4.8+6);
  pdf.setFont('helvetica','normal');pdf.text(note,left,y);y+=note.length*4.8+4;
 }
 ensure(14);line(y);y+=7;
 pdf.setFont('helvetica','bold');pdf.setFontSize(10);setText(...ink);
 pdf.text('TOTAL: '+format(total)+' UNIDADES',right,y,{align:'right'});
 pageFoot();
 const blob=pdf.output('blob');
 if(blob.type!=='application/pdf')throw new Error('Não foi possível gerar o PDF');
 return {blob,filename:pdfFilename(order)};
}
export function downloadPurchasePDF({blob,filename}){
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
