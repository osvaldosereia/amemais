// Catálogo: importar e exportar planilhas compatíveis com AME MAIS ESTOQUE.
// Sem importação automática: o gestor deve revisar o resumo e confirmar.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.1';
const cfg=window.AME_CONFIG||{};
const db=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
  auth:{autoRefreshToken:false,persistSession:true,detectSessionInUrl:false}
});
const HEADERS=['Importar','SKU','Nome','Codigo de barras','Tipo codigo','Unidade','Preco venda','Ativo',
'Categoria','Subcategoria','Subsubcategoria','Tags','Familia','Tamanho','Cor','Tipo roupa',
'Publico','Faixa etaria','Fornecedor','Estoque minimo','Pedido minimo','Estoque inicial',
'Gondola','Prateleira','Foto URL','Codigo SAP','Codigo original','Observacoes','Confianca','Revisao'];
const escapeHtml=(x)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').trim().toLocaleLowerCase('pt-BR');
let imported=[],busy=false,currentName='';
async function xlsx(){
  if(window.XLSX)return window.XLSX;
  if(!window.__ameXlsxLoading)window.__ameXlsxLoading=new Promise((resolve,reject)=>{
    const el=document.createElement('script');
    el.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    el.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Biblioteca Excel indisponível'));
    el.onerror=()=>reject(new Error('Não foi possível carregar o leitor de Excel. Verifique a conexão.'));
    document.head.appendChild(el);
  });
  return window.__ameXlsxLoading;
}
async function allRows(table,columns='*',filter=null){
  const result=[];
  for(let from=0;from<30000;from+=750){
    let query=db.from(table).select(columns).order('id').range(from,from+749);
    if(filter)query=filter(query);
    const {data,error}=await query;
    if(error)throw error;
    result.push(...(data||[]));
    if(!data||data.length<750)break;
  }
  return result;
}
function parseDelimited(text){
  text=text.replace(/^\uFEFF/,'');
  const delimiter=text.split(/\r?\n/,1)[0].includes(';')?';':',';
  let data=[],row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++;continue;}
    if(ch==='"'){quoted=!quoted;continue;}
    if(ch===delimiter&&!quoted){row.push(cell);cell='';continue;}
    if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&text[i+1]==='\n')i++;
      row.push(cell);if(row.some(x=>x!==''))data.push(row);
      row=[];cell='';continue;
    }
    cell+=ch;
  }
  row.push(cell);if(row.some(x=>x!==''))data.push(row);
  const [headers,...lines]=data;
  return lines.map(line=>Object.fromEntries(headers.map((header,i)=>[header.trim(),line[i]??''])));
}
async function parseFile(file){
  const name=file.name.toLowerCase();
  let rows;
  if(name.endsWith('.csv')){
    rows=parseDelimited(await file.text());
  }else if(name.endsWith('.xlsx')||name.endsWith('.xls')){
    const lib=await xlsx();
    const book=lib.read(await file.arrayBuffer(),{type:'array',cellDates:false});
    const sheet=book.Sheets.Produtos||book.Sheets[book.SheetNames[0]];
    rows=lib.utils.sheet_to_json(sheet,{defval:'',raw:false});
  }else throw new Error('Escolha Excel (.xlsx/.xls) ou CSV.');
  if(!rows.length)throw new Error('Planilha vazia.');
  const missing=['SKU','Nome','Categoria','Importar'].filter(k=>!Object.hasOwn(rows[0],k));
  if(missing.length)throw new Error('Formato incompatível. Colunas faltando: '+missing.join(', ')+'. Baixe o modelo.');
  return rows.map((raw,i)=>Object.fromEntries([...HEADERS,'__linha'].map(h=>
    [h,h==='__linha'?i+2:String(raw[h]??'').trim()])));
}
function modal(){
  let el=document.querySelector('#ame-transfer-modal');
  if(el)return el;
  el=document.createElement('div');
  el.id='ame-transfer-modal';
  el.className='ame-transfer-backdrop';
  el.innerHTML=`<section class="ame-transfer-window" role="dialog" aria-modal="true" aria-labelledby="ame-transfer-title">
    <header><div><h2 id="ame-transfer-title">Importar / exportar produtos</h2>
      <p>Cadastros, variações e classificação. Não modifica estoques existentes.</p></div>
      <button type="button" data-transfer-close aria-label="Fechar">×</button></header>
    <main>
      <div class="ame-transfer-actions">
        <button type="button" class="button" data-transfer-template>Baixar modelo vazio</button>
        <button type="button" class="button" data-transfer-export>Exportar cadastro (.xlsx)</button>
      </div>
      <label class="ame-transfer-file">Selecionar planilha Excel ou CSV
        <input type="file" accept=".xlsx,.xls,.csv" data-transfer-file />
      </label>
      <p class="ame-transfer-help">Importar = SIM inclui o registro; REVISAR e NAO nunca são gravados. Os códigos devem ser únicos.</p>
      <div class="ame-transfer-preview" data-transfer-preview>Selecione o arquivo organizado para revisar a importação.</div>
      <div class="ame-transfer-options" hidden data-transfer-options>
        <label><input type="checkbox" data-transfer-create-categories /> Criar categorias/subcategorias ausentes, como propostas na planilha</label>
        <label><input type="checkbox" data-transfer-update /> Atualizar cadastros existentes pelo SKU (sem modificar estoque)</label>
        <label><input type="checkbox" data-transfer-stock /> Lançar estoque inicial somente para produtos novos com quantidade explicitamente informada</label>
        <button type="button" class="button primary" data-transfer-import>Confirmar importação</button>
      </div>
      <div class="ame-transfer-status" role="status" aria-live="polite" data-transfer-status></div>
    </main>
  </section>`;
  document.body.appendChild(el);
  el.addEventListener('click',async event=>{
    if(event.target===el||event.target.closest('[data-transfer-close]')){if(!busy)el.remove();return;}
    const item=event.target.closest('[data-transfer-template],[data-transfer-export],[data-transfer-import]');
    if(!item||busy)return;
    try{
      if(item.hasAttribute('data-transfer-template'))await template();
      else if(item.hasAttribute('data-transfer-export'))await exportCatalog();
      else await importCatalog();
    }catch(e){status('Erro: '+e.message,true);}
  });
  el.querySelector('[data-transfer-file]').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    currentName=file.name;status('Lendo '+file.name+'…');
    try{imported=await parseFile(file);await preview();}catch(e){
      imported=[];el.querySelector('[data-transfer-options]').hidden=true;status(e.message,true);
    }
  });
  return el;
}
function status(message,isError=false){
  const x=document.querySelector('[data-transfer-status]');
  if(!x)return;
  x.textContent=message;x.classList.toggle('error',isError);
}
function saveFile(blob,name){
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function writeXlsx(rows,filename){
  const lib=await xlsx();const book=lib.utils.book_new();
  const sheet=lib.utils.json_to_sheet(rows,{header:HEADERS,skipHeader:false});
  sheet['!cols']=HEADERS.map(k=>({wch:k==='Nome'?46:k==='Observacoes'?46:k==='Familia'?38:k==='Tags'?35:19}));
  // Códigos numéricos devem permanecer texto (inclusive zeros à esquerda).
  for(const cell of Object.keys(sheet)){
    if(!/^[A-Z]+[0-9]+$/.test(cell))continue;
    if(sheet[cell].t==='s')sheet[cell].z='@';
  }
  lib.utils.book_append_sheet(book,sheet,'Produtos');
  saveFile(new Blob([lib.write(book,{bookType:'xlsx',type:'array'})],{
    type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }),filename);
}
async function template(){
  await writeXlsx([],'modelo_ame_mais_produtos.xlsx');status('Modelo Excel gerado.');
}
async function exportCatalog(){
  busy=true;status('Carregando todos os produtos para exportação…');
  try{
    const [products,categories,suppliers,models]=await Promise.all([
      allRows('products'),allRows('categories'),allRows('suppliers'),allRows('apparel_models')
    ]);
    const cm=new Map(categories.map(c=>[c.id,c]));
    const sm=new Map(suppliers.map(c=>[c.id,c.name]));
    const mm=new Map(models.map(c=>[c.id,c]));
    function path(id){
      let chain=[],visited=new Set();
      while(id&&!visited.has(id)&&chain.length<6){
        visited.add(id);const c=cm.get(id);if(!c)break;chain.unshift(c.name);id=c.parent_id;
      }
      return chain;
    }
    const data=products.map(p=>{
      const categories=path(p.category_id),model=mm.get(p.apparel_model_id);
      return {
        'Importar':p.active?'SIM':'NAO','SKU':p.sku||'', 'Nome':p.name||'',
        'Codigo de barras':p.ean||'', 'Tipo codigo':p.ean?.length===9?'Código interno':'',
        'Unidade':p.sales_unit||'UN','Preco venda':p.sale_price??'','Ativo':p.active?'SIM':'NAO',
        'Categoria':categories[0]||'','Subcategoria':categories[1]||'',
        'Subsubcategoria':categories.slice(2).join(' > '),'Tags':(p.tags||[]).join(', '),
        'Familia':model?.name||'','Tamanho':p.apparel_size||'','Cor':p.apparel_color||'',
        'Tipo roupa':model?.garment_type||'','Publico':model?.audience||'',
        'Faixa etaria':model?.age_group||'','Fornecedor':sm.get(p.supplier_id)||'',
        'Estoque minimo':p.min_stock??0,'Pedido minimo':p.minimum_order_quantity??1,
        'Estoque inicial':'','Gondola':p.gondola||'','Prateleira':p.prateleira||'',
        'Foto URL':p.external_photo_url||'','Codigo SAP':p.sap_code||'',
        'Codigo original':p.legacy_code||'','Observacoes':'',
        'Confianca':'Cadastro existente','Revisao':''
      };
    });
    await writeXlsx(data,'cadastro_produtos_ame_mais_'+new Date().toISOString().slice(0,10)+'.xlsx');
    status('Exportados '+products.length+' cadastros. Saldo físico não é tratado como estoque inicial.');
  }finally{busy=false;}
}
async function preview(){
  const target=modal().querySelector('[data-transfer-preview]');
  const selected=imported.filter(r=>r.Importar.toUpperCase()==='SIM');
  const omitted=imported.length-selected.length;
  const problems=[],localSku=new Set(),localBarcode=new Map();
  const [existing,categories,suppliers]=await Promise.all([
    allRows('products','id,sku,ean,active'),allRows('categories'),allRows('suppliers','id,name,active')
  ]);
  const bySku=new Map(existing.filter(p=>p.active).map(p=>[p.sku,p]));
  const byEan=new Map(existing.filter(p=>p.active&&p.ean).map(p=>[p.ean,p]));
  const supply=new Set(suppliers.filter(s=>s.active).map(s=>norm(s.name)));
  const pathMap=new Set(categories.map(c=>[c.parent_id||'raiz',norm(c.name)].join('|')));
  const maybeNewCategory=new Set(),possibleUpdates=[];
  for(const [i,r] of selected.entries()){
    const tag='Linha '+r.__linha+' (SKU '+r.SKU+'): ';
    if(!r.SKU||r.SKU.length>80||r.Nome.length<2||r.Nome.length>180)problems.push(tag+'SKU/nome inválido');
    if(localSku.has(r.SKU))problems.push(tag+'SKU duplicado na planilha');
    localSku.add(r.SKU);
    if(r['Codigo de barras']&&!/^\d{8,14}$/.test(r['Codigo de barras']))problems.push(tag+'código de barras inválido');
    if(r['Codigo de barras']){
      if(localBarcode.has(r['Codigo de barras']))problems.push(tag+'código de barras duplicado na planilha');
      localBarcode.set(r['Codigo de barras'],r.SKU);
      const old=byEan.get(r['Codigo de barras']);
      if(old&&old.sku!==r.SKU)problems.push(tag+'código de barras pertence a outro SKU no banco');
    }
    const existingProduct=bySku.get(r.SKU);
    if(existingProduct)possibleUpdates.push(r.SKU);
    if(!r.Categoria||['A classificar','Operacionais'].includes(r.Categoria))problems.push(tag+'categoria pendente');
    if(r.Familia||r.Tamanho||r.Cor){
      if(!r.Familia||!r.Tamanho||!r.Cor)problems.push(tag+'Família, tamanho e cor incompletos');
    }
    if(r.Fornecedor&&!supply.has(norm(r.Fornecedor)))problems.push(tag+'fornecedor não cadastrado: '+r.Fornecedor);
    for(const f of ['Estoque minimo','Pedido minimo','Estoque inicial']){
      const value=r[f];if(value!==''&&!/^\d+$/.test(value))problems.push(tag+f+' inválido');
    }
    for(const f of ['Categoria','Subcategoria','Subsubcategoria']){
      const value=r[f];if(value&&value.length>90)problems.push(tag+f+' excede 90 caracteres');
    }
    if(r.Categoria&&!categories.some(x=>!x.parent_id&&norm(x.name)===norm(r.Categoria)))maybeNewCategory.add(r.Categoria);
    const price=r['Preco venda'];
    if(price!==''&&!Number.isFinite(Number(String(price).replace(',','.'))))problems.push(tag+'preço inválido');
  }
  const shown=problems.slice(0,16).map(p=>'<li>'+escapeHtml(p)+'</li>').join('');
  target.innerHTML=`<div class="ame-transfer-metrics">
    <strong>${imported.length} linhas</strong><strong>${selected.length} selecionadas</strong>
    <strong>${omitted} não selecionadas</strong><strong>${possibleUpdates.length} SKUs já existentes</strong>
    <strong>${maybeNewCategory.size} categorias-raiz novas</strong>
    <strong class="${problems.length?'error':''}">${problems.length} problemas</strong>
  </div>`+
  (problems.length?'<p>Corrija antes de importar (primeiros 16):</p><ul>'+shown+'</ul>':
    '<p>Nenhum conflito básico encontrado. Confirme as opções para gravar em lotes de até 60 produtos.</p>');
  const options=modal().querySelector('[data-transfer-options]');
  options.hidden=!selected.length||problems.length>0;
  options.querySelector('[data-transfer-stock]').checked=false;
  status(problems.length?'Há '+problems.length+' problemas. Nenhum cadastro foi gravado.':
    'Arquivo '+currentName+' lido. Nenhuma alteração realizada.');
}
async function importCatalog(){
  if(!imported.length)throw new Error('Selecione uma planilha.');
  const options=modal().querySelector('[data-transfer-options]');
  const selected=imported.filter(r=>r.Importar.toUpperCase()==='SIM');
  const create=options.querySelector('[data-transfer-create-categories]').checked;
  const update=options.querySelector('[data-transfer-update]').checked;
  const stock=options.querySelector('[data-transfer-stock]').checked;
  if(!selected.length)throw new Error('Nenhum produto marcado SIM.');
  if(!confirm('Importar '+selected.length+' cadastros? '+(create?'Categorias ausentes serão criadas. ':'')+
     (update?'Cadastros existentes serão atualizados. ':'')+
     (stock?'Saldos iniciais informados serão lançados.':'Nenhum saldo inicial será lançado.')))return;
  busy=true;
  const summary={inseridos:0,atualizados:0,ignorados:0,categoriasCriadas:0,estoquesLancados:0};
  try{
    for(let pos=0;pos<selected.length;pos+=60){
      status('Importando '+Math.min(pos+60,selected.length)+' de '+selected.length+'…');
      const payload=selected.slice(pos,pos+60).map(r=>({
        ...Object.fromEntries(HEADERS.map(k=>[k,k==='Preco venda'?String(r[k]).replace(',','.'):r[k]]))
      }));
      const {data,error}=await db.rpc('import_products_batch',{
        p_rows:payload,p_create_categories:create,p_update_existing:update,p_import_initial_stock:stock
      });
      if(error)throw new Error('Lote iniciado na linha '+selected[pos].__linha+': '+error.message);
      Object.keys(summary).forEach(k=>summary[k]+=Number(data?.[k]||0));
    }
    status('Concluído. '+summary.inseridos+' criados, '+summary.atualizados+' atualizados, '+
      summary.ignorados+' ignorados; '+summary.categoriasCriadas+' categorias criadas e '+
      summary.estoquesLancados+' lançamentos de estoque inicial. Atualize a página para ver o catálogo.');
    options.hidden=true;
  }catch(error){
    status('Importação interrompida: '+error.message+' Os lotes anteriores podem ter sido gravados. '+
      'Até aqui: '+summary.inseridos+' criados, '+summary.atualizados+' atualizados. '+
      'Uma nova importação ignora SKUs já existentes por padrão.',true);
  }finally{busy=false;}
}
function installButtons(){
  const head=document.querySelector('.products-pagehead .actions');
  if(!head||head.querySelector('[data-open-catalog-transfer]'))return;
  const b=document.createElement('button');
  b.type='button';b.className='button ame-transfer-launch';
  b.dataset.openCatalogTransfer='1';
  b.textContent='Importar / Exportar';
  b.addEventListener('click',()=>modal());
  head.prepend(b);
}
if(cfg.supabaseUrl&&cfg.supabasePublishableKey){
  const root=document.querySelector('#app');
  if(root){
    new MutationObserver(()=>installButtons()).observe(root,{childList:true,subtree:true});
    installButtons();
  }
}
