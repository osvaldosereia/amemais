// Carrega o catálogo completo sem depender do limite de linhas por requisição PostgREST.
// A ordem (nome, ID) mantém a paginação determinística mesmo com nomes repetidos.
export async function loadAllProducts(db,{pageSize=500,maxPages=200}={}){
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>1000)throw Error('Tamanho da página inválido.');
 if(!Number.isInteger(maxPages)||maxPages<1)throw Error('Limite de páginas inválido.');
 const list=[],seen=new Set();
 for(let page=0;page<maxPages;page++){
  const start=page*pageSize;
  const {data,error,count}=await db.from('products').select('*',{count:'exact'})
   .order('name',{ascending:true}).order('id',{ascending:true})
   .range(start,start+pageSize-1);
  if(error)throw error;
  if(!Array.isArray(data))throw Error('Resposta inválida ao carregar catálogo.');
  // Se o projeto impuser um limite menor, não aceitar um catálogo truncado silenciosamente.
  if(data.length<pageSize&&typeof count==='number'&&count>start+data.length)
   throw Error('A API limitou a consulta de produtos. Ajuste a paginação do catálogo.');
  for(const product of data){
   if(!product?.id)throw Error('Produto sem identificador retornado pelo banco.');
   if(seen.has(product.id))continue;
   seen.add(product.id);list.push(product);
  }
  if(data.length<pageSize)return {data:list,error:null};
 }
 throw Error('Catálogo excedeu o limite de páginas. A busca foi interrompida para evitar resultados incompletos.');
}
