// Resolução única de códigos no CDSB: EAN exato, SKU exato e sufixo EAN de 9 dígitos.
// Jamais escolhe automaticamente quando há mais de uma variação possível.
export const normalizeProductCode=value=>String(value??'').trim();
const numericCode=value=>/^[0-9\s-]+$/.test(value)?value.replace(/[\s-]/g,''):null;
export function findProductByCode(items,code,{activeOnly=true}={}){
 const query=normalizeProductCode(code);
 if(!query)return {item:null,matches:[],status:'empty'};
 const digits=numericCode(query);
 const eligible=(Array.isArray(items)?items:[]).filter(p=>
   p&&(activeOnly?(p.active&&!p.force_archived_at):true));
 const exact=eligible.filter(p=>{
   const ean=normalizeProductCode(p.ean);
   const sku=normalizeProductCode(p.sku);
   return (ean&&(ean===query||(digits!==null&&numericCode(ean)===digits)))||
     (sku&&sku.toLocaleLowerCase('pt-BR')===query.toLocaleLowerCase('pt-BR'));
 });
 if(exact.length)return {item:exact.length===1?exact[0]:null,matches:exact,
   status:exact.length===1?'exact':'ambiguous'};
 if(!digits||digits.length<9)return {item:null,matches:[],status:'notfound'};
 const nine=digits.slice(-9);
 const matches=eligible.filter(p=>{
   const ean=numericCode(normalizeProductCode(p.ean));
   return ean&&ean.length>=9&&ean.slice(-9)===nine;
 });
 return {item:matches.length===1?matches[0]:null,matches,
   status:matches.length===1?'last9':matches.length>1?'ambiguous':'notfound'};
}
