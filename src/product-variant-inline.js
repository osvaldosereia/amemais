// Editor da variação no próprio painel de Produtos. Sem modal adicional.
const h=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const input=(label,name,value,attrs='')=>'<label class="product-inline-field"><span>'+h(label)+'</span><input name="'+name+'" value="'+h(value??'')+'" '+attrs+'></label>';
const opt=(value,label,current)=>'<option value="'+h(value)+'"'+(String(value)===String(current)?' selected':'')+'>'+h(label)+'</option>';
export function variantInlineEditor(p,{allowedSizes=[],gondolas=[]}={}){
 if(!p?.id)throw Error('Variação não localizada.');
 const currentSize=p.apparel_size||'Único',gondola=p.gondola||'';
 const sizes=[...new Set([...allowedSizes,currentSize].filter(Boolean))];
 const available=[...new Set(gondolas.filter(x=>x.active||x.name===gondola).map(x=>x.name).concat(gondola?[gondola]:[]))].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true}));
 const size=p.apparel_model_id?'<label class="product-inline-field"><span>Variação</span><select name="size" required>'+
  sizes.map(s=>opt(s,s,currentSize)).join('')+'</select></label>':'';
 return '<form class="product-variant-inline-form" data-form="product-drawer-variant" data-id="'+h(p.id)+'" data-unsaved="false">'+
 '<div class="product-variant-inline-heading"><strong>Editar '+h(currentSize)+'</strong>'+
 '<button type="button" class="button small" data-action="product-variant-inline-cancel">Cancelar</button></div>'+
 '<div class="product-variant-inline-fields">'+size+
 input('Código interno (SKU)','sku',p.sku||'','maxlength="80" autocomplete="off"')+
 input('EAN / código de barras','ean',p.ean||'','maxlength="14" inputmode="numeric"')+
 '<label class="product-inline-field"><span>Gôndola</span><select name="gondola">'+
 opt('','Sem gôndola definida',gondola)+available.map(x=>opt(x,x,gondola)).join('')+'</select></label>'+
 input('Prateleira','prateleira',p.prateleira||'','maxlength="40"')+
 '<label class="product-inline-field"><span>Situação</span><select name="active">'+
 opt('true','Ativa',String(p.active))+opt('false','Inativa',String(p.active))+'</select></label></div>'+
 '<p class="product-variant-inline-hint">Estes dados não alteram saldos ou reservas do estoque.</p>'+
 '<div class="product-variant-inline-actions"><button class="button primary" type="submit">Salvar alterações</button></div></form>';
}
export function variantInlinePayload(values,{item,allowedSizes=[],gondolas=[]}={}){
 if(!item?.id)throw Error('Variação não localizada.');
 const v=key=>String(values?.[key]??'').trim();
 const sku=v('sku'),ean=v('ean').replace(/[\s-]/g,''),gondola=v('gondola'),prateleira=v('prateleira'),active=v('active');
 const size=item.apparel_model_id?v('size'):item.apparel_size||'Único';
 if(sku.length>80)throw Error('SKU deve ter até 80 caracteres.');
 if(ean&&!/^\d{8,14}$/.test(ean))throw Error('O EAN deve conter de 8 a 14 dígitos.');
 if(prateleira.length>40||gondola.length>40)throw Error('Confira gôndola e prateleira.');
 if(gondola&&gondola!==item.gondola&&!gondolas.some(g=>g.name===gondola&&g.active))throw Error('Gôndola indisponível. Selecione uma gôndola cadastrada.');
 if(!['true','false'].includes(active))throw Error('Situação inválida.');
 if(item.apparel_model_id&&![...allowedSizes,item.apparel_size].some(s=>String(s).toLocaleLowerCase('pt-BR')===size.toLocaleLowerCase('pt-BR')))
  throw Error('Esta variação não pertence à categoria do produto.');
 return {sku:sku||null,ean:ean||null,gondola:gondola||null,prateleira:prateleira||null,active:active==='true',size};
}
