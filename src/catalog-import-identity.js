// Comparação de identidade para importação somente de novos produtos.
export const normalizeImportSku=value=>String(value??'').trim().toLocaleLowerCase('pt-BR');
export const normalizeImportEan=value=>String(value??'').replace(/[\s-]/g,'').trim();
const nine=e=>/^\d{9,}$/.test(e)?e.slice(-9):null;
export function classifyCatalogImport(rows=[],existing=[]){
 const skus=new Set(),eans=new Set(),suffixes=new Set();
 function add(sku,ean){
  const key=normalizeImportSku(sku),code=normalizeImportEan(ean);
  if(key)skus.add(key);
  if(code){eans.add(code);const last=nine(code);if(last)suffixes.add(last);}
 }
 for(const item of existing)add(item.sku,item.ean);
 const newRows=[],skippedRows=[];
 for(const row of rows){
  const sku=normalizeImportSku(row.SKU),ean=normalizeImportEan(row['Codigo de barras']);
  const duplicate=Boolean((sku&&skus.has(sku))||
   (ean&&(eans.has(ean)||(nine(ean)&&suffixes.has(nine(ean))))));
  if(duplicate)skippedRows.push(row);
  else{newRows.push(row);add(sku,ean);}
 }
 return {newRows,skippedRows};
}
