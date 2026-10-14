// Visualizador público de um único produto: token secreto com expiração no banco.
// Esta função nunca aceita ID arbitrário nem devolve dados de outros produtos.
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const allowedOrigins = new Set([
  "https://osvaldosereia.github.io",
  "https://cdsb.net.br",
  "https://www.cdsb.net.br"
]);
function cors(request: Request) {
  const origin=request.headers.get("origin")||"";
  return {
    ...(allowedOrigins.has(origin)?{"Access-Control-Allow-Origin":origin}:{}),
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type, apikey, x-client-info",
    "Vary":"Origin",
    "Cache-Control":"no-store, private",
    "X-Robots-Tag":"noindex, nofollow, noarchive"
  };
}
function json(data:unknown,status:number,headers:Record<string,string>) {
  return new Response(JSON.stringify(data),{
    status,headers:{...headers,"Content-Type":"application/json; charset=utf-8"}
  });
}

Deno.serve(async(request:Request)=>{
  const headers=cors(request);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method!=="POST")return json({error:"Método não permitido"},405,headers);
  const origin=request.headers.get("origin");
  if(origin&&!allowedOrigins.has(origin))return json({error:"Origem não autorizada"},403,headers);
  // Token no corpo da requisição; não trafega em URLs nem em logs de acesso.
  if(Number(request.headers.get("content-length")||0)>1024)
    return json({error:"Requisição inválida"},400,headers);
  let payload:Record<string,unknown>={};
  try{payload=await request.json();}catch{return json({error:"Requisição inválida"},400,headers);}
  const token=typeof payload.token==="string"?payload.token:"";
  if(!/^[0-9a-f]{64}$/.test(token))
    return json({error:"Link inválido ou expirado"},404,headers);
  const url=Deno.env.get("SUPABASE_URL");
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return json({error:"Serviço temporariamente indisponível"},503,headers);
  const client=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  try{
    if(payload.action==="place_order"){
      const name=typeof payload.name==="string"?payload.name:"";
      const phone=typeof payload.phone==="string"?payload.phone:"";
      const items=payload.items;
      const requestId=typeof payload.request_id==="string"?payload.request_id:"";
      if(name.length>120||phone.length>25||!Array.isArray(items)||items.length>40||
         !/^[0-9a-fA-F-]{36}$/.test(requestId))
        return json({error:"Dados do pedido inválidos"},400,headers);
      const {data:orderId,error:orderError}=await client.rpc("create_avulso_order",{
        p_name:name,p_phone:phone,p_items:items,p_share_token:token,p_event_id:null,
        p_request_id:requestId
      });
      if(orderError){
        console.warn("create_avulso_order rejected",orderError.code);
        const message=String(orderError.message||"");
        const expected=/nome|telefone|pedido|quantidade|variação|Produto|produto|Link|link|Muitos pedidos/i.test(message);
        return json({error:expected?message:"Não foi possível registrar o pedido"},expected?400:500,headers);
      }
      return json({order_id:orderId,created_at:new Date().toISOString()},200,headers);
    }
    if(payload.action!==undefined && payload.action!=="get")
      return json({error:"Operação não reconhecida"},400,headers);
    const {data,error}=await client.rpc("get_shared_product_for_server",{p_token:token});
    if(error){
      console.error("get_shared_product_for_server error",error.code);
      return json({error:"Não foi possível consultar o produto"},500,headers);
    }
    if(!data)return json({error:"Link inválido, vencido ou produto indisponível"},404,headers);
    let photo_url:null|string=null;
    if(data.photo_path&&typeof data.photo_path==="string"){
      // Bucket original é privado; apenas foto do produto autorizado recebe URL temporária.
      const signed=await client.storage.from("ame-produtos").createSignedUrl(data.photo_path,300);
      if(!signed.error)photo_url=signed.data.signedUrl;
    }
    return json({
      title:data.title,
      photo_url,
      variants:data.variants,
      expires_at:data.expires_at,
      updated_at:new Date().toISOString()
    },200,headers);
  }catch(error){
    console.error("Shared product unexpected error",String(error).slice(0,140));
    return json({error:"Erro ao carregar o produto"},500,headers);
  }
});
