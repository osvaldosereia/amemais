// Busca exata por EAN/SKU; se não encontrada, compara os nove dígitos finais do EAN.
// Em colisão nunca seleciona um produto automaticamente.
export function findProductByCode(items,code){
 const query=String(code??'').trim();
 if(!query)return {item:null,matches:[],status:'empty'};
 const active=items.filter(p=>p.active&&!p.force_archived_at);
 const exact=active.filter(p=>String(p.ean||'').trim()===query||
    String(p.sku||'').trim().toLocaleLowerCase('pt-BR')===query.toLocaleLowerCase('pt-BR'));
 if(exact.length)return {item:exact.length===1?exact[0]:null,matches:exact,
    status:exact.length===1?'exact':'ambiguous'};
 if(!/^\d{9,}$/.test(query))return {item:null,matches:[],status:'notfound'};
 const nine=query.slice(-9);
 const matches=active.filter(p=>/^\d{9,}$/.test(String(p.ean||'').trim())&&
    String(p.ean).trim().slice(-9)===nine);
 return {item:matches.length===1?matches[0]:null,matches,
    status:matches.length===1?'last9':matches.length>1?'ambiguous':'notfound'};
}
