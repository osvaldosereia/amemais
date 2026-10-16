// Leitores USB normalmente terminam cada EAN com Enter.
// Em cadastros de produtos, somente o botão Salvar/Cadastrar deve enviar o formulário.
const productForms=new Set(['product-new','product-edit','apparel-create','apparel-edit-variant','extra-sizes']);
const eanNames=new Set(['ean','size_ean','variant_ean','extra_ean']);
export function preventScannerSubmit(event){
 if(event?.key!=='Enter'||event.isComposing||event.ctrlKey||event.altKey||event.metaKey)return false;
 const target=event.target;
 if(!target||target.tagName!=='INPUT'&&target.tagName!=='SELECT')return false;
 if(target.type==='submit'||target.type==='button')return false;
 const form=target.closest?.('form[data-form]')||target.closest?.('form');
 if(!form||!productForms.has(form.dataset?.form))return false;
 event.preventDefault();
 event.stopPropagation?.();
 // Em cadastro com muitos tamanhos, posicionar o cursor no próximo EAN,
 // mas nunca salvar automaticamente o que o leitor acabou de preencher.
 if(eanNames.has(target.name)&&/^[0-9]{8,14}$/.test(String(target.value||'').trim())){
  const fields=[...form.querySelectorAll('input[name="size_ean"]:not(:disabled),input[name="variant_ean"]:not(:disabled),input[name="extra_ean"]:not(:disabled)')];
  const index=fields.indexOf(target);
  if(index>=0&&index+1<fields.length)fields[index+1].focus({preventScroll:true});
 }
 return true;
}
