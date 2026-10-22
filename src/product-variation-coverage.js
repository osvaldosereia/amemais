// Cobertura das variações: a categoria define opções, não cria SKUs.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const variationKey=value=>String(value??'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').trim().replace(/^tamanho\s+/i,'')
 .replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
export function categoryVariationCoverage(options=[],products=[],{isModel=false}={}){
 const registered=isModel?products.filter(p=>p&&!p.force_archived_at&&p.apparel_size):[];
 const normalized=new Map();
 for(const item of registered){
  const key=variationKey(item.apparel_size);
  if(!key)continue;
  if(!normalized.has(key)||(!normalized.get(key).active&&item.active))normalized.set(key,item);
 }
 const seen=new Set();
 const rows=[];
 for(const candidate of options){
  const label=String(candidate||'').trim(),key=variationKey(label);
  if(!key||seen.has(key))continue;
  seen.add(key);
  const p=normalized.get(key);
  rows.push({label,kind:p?(p.active?'registered':'inactive'):'missing',productId:p?.id||null});
 }
 const keys=new Set(rows.map(row=>variationKey(row.label)));
 const legacy=registered.filter(p=>!keys.has(variationKey(p.apparel_size)));
 return {
  rows,legacy,registered:rows.filter(r=>r.kind==='registered').length,
  inactive:rows.filter(r=>r.kind==='inactive').length,
  missing:rows.filter(r=>r.kind==='missing').length,
  unassigned:!isModel&&products.some(p=>p&&!p.force_archived_at&&!p.apparel_size)
 };
}
const text=(v,kind='')=>'<span class="'+kind+'">'+esc(v)+'</span>';
const field=(name,placeholder='',attrs='')=>'<input name="'+name+'" '+attrs+
 ' placeholder="'+esc(placeholder)+'" aria-label="'+name+'" autocomplete="off">';
export function variationTableHTML(options,products,{
 isModel=false,canEdit=false,main=null,modelId=null,physicalFor=()=>0
}={}){
 const coverage=categoryVariationCoverage(options,products,{isModel});
 if(!coverage.rows.length)
  return '<p class="product-variation-table-empty">Não há tamanhos definidos nesta categoria. Configure-os em Categorias.</p>';
 const byId=new Map(products.map(p=>[p.id,p]));
 const color=products.find(p=>p.active)?.apparel_color||'Única';
 const intro=isModel?
  'Os tamanhos já cadastrados aparecem para consulta. Para cadastrar novos SKUs, informe uma quantidade maior que zero.':
  'Marque qual tamanho pertence ao SKU existente. Os demais tamanhos só serão cadastrados se o estoque inicial for maior que zero.';
 const lines=coverage.rows.map(r=>{
  const p=byId.get(r.productId);
  const cell=p?'<div class="variation-table-existing-code">'+esc(p.sku||'—')+'</div>':
   field('sku','Automático','maxlength="80"');
  const ean=p?'<div class="variation-table-existing-code">'+esc(p.ean||'—')+'</div>':
   field('ean','Opcional','maxlength="14" inputmode="numeric"');
  const qty=p?'<strong class="variation-table-quantity">'+Number(physicalFor(p.id)||0).toLocaleString('pt-BR')+'</strong>':
   field('quantity','0','type="number" min="0" max="1000000" step="1" value="0" inputmode="numeric"');
  const choose=!isModel&&!p?
    '<label class="variation-table-original-label"><input type="radio" name="existing_size" value="'+esc(r.label)+
    '" required><span>SKU atual</span></label>':'';
  const status=p?'<span class="variation-table-status is-'+(p.active?'registered':'inactive')+'">'+(p.active?'Cadastrado':'Inativo')+'</span>':
    '<span class="variation-table-status is-missing">Novo</span>';
  const edit=p&&canEdit?'<button type="button" class="button small" data-action="'+
    (p.active?'apparel-variant-edit':'product-drawer-reactivate-variation')+'" data-id="'+esc(p.id)+'">'+
    (p.active?'Editar':'Reativar')+'</button>':'';
  return '<tr data-variation-table-row data-size="'+esc(r.label)+'" data-kind="'+esc(r.kind)+'">'+
    '<th scope="row"><strong>'+esc(r.label)+'</strong>'+status+choose+'</th>'+
    '<td>'+cell+'</td><td>'+ean+'</td><td>'+qty+'</td>'+
    '<td>'+edit+'</td></tr>';
 }).join('');
 const legacy=coverage.legacy.length?
   '<p class="variation-table-legacy">Tamanhos antigos preservados: '+
     esc([...new Set(coverage.legacy.map(p=>p.apparel_size))].join(' · '))+'</p>':'';
 return '<form data-form="product-variation-table" data-model-id="'+esc(modelId||'')+
   '" data-id="'+esc(main?.id||'')+'" data-is-model="'+String(isModel)+'" data-unsaved="false" class="variation-table-form">'+
   '<header class="variation-table-heading"><div><strong>Tamanhos da categoria</strong>'+
    '<p>'+esc(intro)+'</p></div><small>'+coverage.rows.length+' tamanho(s)</small></header>'+
   (!isModel?'<div class="variation-table-original-notice"><strong>SKU atual: '+esc(main?.sku||'—')+
     '</strong><small>EAN: '+esc(main?.ean||'—')+' · o saldo existente não será alterado</small></div>':'')+
   '<div class="variation-table-scroll"><table class="variation-table"><thead><tr>'+
    '<th scope="col">Tamanho</th><th scope="col">SKU</th><th scope="col">EAN</th>'+
    '<th scope="col">'+(isModel?'Estoque físico / inicial':'Estoque inicial')+'</th>'+
    '<th scope="col">Ação</th></tr></thead><tbody>'+lines+'</tbody></table></div>'+
   legacy+
   (canEdit?'<div class="variation-table-bottom"><small>Quantidade 0 = não cadastrar. SKU vazio = gerar automaticamente.</small>'+
    '<button class="button primary" type="submit">'+(isModel?'Cadastrar tamanhos com estoque':'Salvar tamanhos e estoque')+
    '</button></div>':'')+'</form>';
}
export function variationTablePayload(input,{isModel=false,existing=[],allowed=[]}={}){
 const size=String(input?.existingSize||'').trim();
 if(!isModel&&(!size||!allowed.includes(size)))
  throw new Error('Selecione qual tamanho pertence ao SKU atual.');
 const allowedKeys=new Set(allowed.map(variationKey)),taken=new Set(existing.map(p=>variationKey(p.apparel_size)).filter(Boolean));
 const entries=[],usedSizes=new Set(),usedCodes=new Set();
 for(const row of input?.rows||[]){
  const label=String(row.size||'').trim(),key=variationKey(label);
  if(!allowedKeys.has(key))throw new Error('Tamanho indisponível nesta categoria: '+label);
  if(!isModel&&variationKey(size)===key)continue;
  if(taken.has(key))continue;
  const raw=String(row.quantity??'').trim(),number=Number(raw);
  if(!/^\d+$/.test(raw)||!Number.isInteger(number)||number<0||number>1000000)
   throw new Error('Estoque inválido no tamanho '+label+'.');
  if(!number)continue;
  if(usedSizes.has(key))throw new Error('Tamanho repetido: '+label);
  usedSizes.add(key);
  const sku=String(row.sku||'').trim(),ean=String(row.ean||'').replace(/[\s-]/g,'');
  if(sku.length>80)throw new Error('SKU acima do limite no tamanho '+label+'.');
  if(ean&&!/^\d{8,14}$/.test(ean))throw new Error('EAN inválido no tamanho '+label+'.');
  for(const code of [sku&&'sku:'+sku.toLowerCase(),ean&&'ean:'+ean]){
   if(!code)continue;
   if(usedCodes.has(code))throw new Error('Código repetido: '+code.split(':')[1]);
   usedCodes.add(code);
  }
  entries.push({size:label,sku:sku||null,ean:ean||null,quantity:number});
 }
 if(isModel&&!entries.length)throw new Error('Informe estoque maior que zero para pelo menos um tamanho novo.');
 return {existingSize:size,entries};
}
