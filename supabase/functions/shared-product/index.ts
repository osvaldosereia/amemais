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
    "Access-Control-Allow-Methods":"GET, OPTIONS",
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
  if(request.method!=="GET")return json({error:"Método não permitido"},405,headers);
  const origin=request.headers.get("origin");
  if(origin&&!allowedOrigins.has(origin))return json({error:"Origem não autorizada"},403,headers);
  const requestUrl=new URL(request.url);
  const token=requestUrl.searchParams.get("token")||"";
  if(!/^[0-9a-f]{64}$/.test(token))
    return json({error:"Link inválido ou expirado"},404,headers);
  const url=Deno.env.get("SUPABASE_URL");
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return json({error:"Serviço temporariamente indisponível"},503,headers);
  const client=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  try{
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
