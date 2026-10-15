import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}})}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Método não permitido"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY");
  const auth=req.headers.get("Authorization")||"";
  if(!url||!anon||!auth.startsWith("Bearer "))return json({error:"Sessão obrigatória"},401);
  const db=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)return json({error:"Sessão inválida"},401);
  const {data:profile,error:profileError}=await db.from("staff_profiles").select("active,role").eq("id",user.id).maybeSingle();
  if(profileError||!profile?.active)return json({error:"Usuário sem acesso"},403);
  if(profile.role!=="admin"){
   const {data:permissions,error:permissionError}=await db.rpc("my_permissions");
   if(permissionError||!permissions?.some(x=>x.permission==="events.manage"))
    return json({error:"Sem permissão de eventos"},403);
  }
  const body=await req.json(),eventId=String(body?.event_id||"");
  if(!/^[0-9a-f-]{36}$/i.test(eventId))return json({error:"Evento inválido"},400);
  const {data:event,error}=await db.from("events").select("name,notes,deleted_at").eq("id",eventId).maybeSingle();
  if(error||!event||event.deleted_at)return json({error:"Evento não encontrado"},404);
  const key=Deno.env.get("OPENAI_API_KEY");
  if(!key)return json({error:"Configure OPENAI_API_KEY nos Secrets da função Supabase para habilitar geração automática."},503);
  const prompt="Crie uma imagem profissional de capa para um evento de uma loja católica de artigos, roupas e presentes. "+
    "Evento: "+event.name.slice(0,150)+". Contexto: "+String(event.notes||"").slice(0,300)+". "+
    "Interprete o conceito de forma respeitosa, elegante e adequada a uma vitrine. "+
    "Fotografia publicitária realista, iluminação suave, composição premium, paleta verde sálvia e creme quando apropriado. "+
    "Paisagem horizontal com assunto principal central, espaço para a UI sobrepor o nome do evento. "+
    "Sem letras, sem palavras, sem logotipos e sem marcas d'água. Evite rostos reconhecíveis.";
  const response=await fetch("https://api.openai.com/v1/images/generations",{
   method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
   body:JSON.stringify({model:"gpt-image-1-mini",quality:"low",size:"1536x1024",
    output_format:"webp",n:1,prompt}),
   signal:AbortSignal.timeout(85000)
  });
  const data=await response.json();
  if(!response.ok||!data.data?.[0]?.b64_json)
   return json({error:"Não foi possível gerar a capa. "+(data.error?.message||"Tente novamente.")},502);
  return json({base64:data.data[0].b64_json,mime:"image/webp"});
 }catch(err){return json({error:err instanceof Error?err.message:"Falha temporária na geração."},500);}
});