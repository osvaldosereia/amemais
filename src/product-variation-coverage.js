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
 const rows=[...new Set(options.map(o=>String(o||'').trim()).filter(Boolean))].map(label=>{
  const p=normalized.get(variationKey(label));
  return {label,kind:p?(p.active?'registered':'inactive'):'missing',productId:p?.id||null};
 });
 const keys=new Set(rows.map(row=>variationKey(row.label)));
 const legacy=registered.filter(p=>!keys.has(variationKey(p.apparel_size)));
 return {
  rows,legacy,registered:rows.filter(r=>r.kind==='registered').length,
  inactive:rows.filter(r=>r.kind==='inactive').length,
  missing:rows.filter(r=>r.kind==='missing').length,
  unassigned:!isModel&&products.some(p=>p&&!p.force_archived_at&&!p.apparel_size)
 };
}
export function categoryVariationCoverageHTML(coverage,{canEdit=false,isModel=false}={}){
 if(!coverage.rows.length)return '<p class="product-variation-no-options">Esta categoria não possui tamanhos configurados. As variações podem ser definidas em Categorias.</p>';
 const title='Tamanhos configurados na categoria';
 const sub=isModel?coverage.registered+' cadastrados · '+coverage.missing+' ainda não cadastrados'+
   (coverage.inactive?' · '+coverage.inactive+' inativos':''):
   'Escolha o tamanho que corresponde ao SKU atual antes de cadastrar os demais.';
 const chips=coverage.rows.map(row=>{
  const status=row.kind==='registered'?'Cadastrado':row.kind==='inactive'?'Inativo':
    (isModel?'Adicionar':'Definir');
  const visual='<span class="product-variation-coverage-label">'+esc(row.label)+'</span>'+
   '<small>'+status+'</small>';
  if(row.kind==='registered'||!canEdit)
   return '<span class="product-variation-coverage-chip is-'+row.kind+'" aria-label="'+esc(row.label)+': '+status+'">'+visual+'</span>';
  return '<button type="button" class="product-variation-coverage-chip is-'+row.kind+
   '" data-action="'+(row.kind==='inactive'?'product-drawer-reactivate-variation':'product-drawer-pick-size')+'"'+
   (row.kind==='inactive'?' data-id="'+esc(row.productId)+'"':' data-size="'+esc(row.label)+'"')+
   ' aria-label="'+(row.kind==='inactive'?'Reativar ':'Cadastrar ')+esc(row.label)+'">'+visual+'</button>';
 }).join('');
 const others=coverage.legacy.length?
  '<p class="product-variation-coverage-warning">Tamanhos antigos fora das opções atuais: '+
   esc([...new Set(coverage.legacy.map(p=>p.apparel_size))].join(' · '))+
   '. Eles continuam vinculados aos respectivos SKUs e podem ser editados sem perda de histórico.</p>':'';
 return '<section class="product-variation-coverage" aria-label="Tamanhos permitidos pela categoria">'+
  '<div class="product-variation-coverage-head"><strong>'+title+'</strong><small>'+esc(sub)+'</small></div>'+
  (coverage.unassigned?'<p class="product-variation-coverage-notice">O SKU atual ainda está como Único. Selecione o tamanho correto: o SKU e seu estoque serão preservados.</p>':'')+
  '<div class="product-variation-coverage-grid">'+chips+'</div>'+others+'</section>';
}
