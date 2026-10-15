import {createClient} from "npm:@supabase/supabase-js@2.49.1";
const origins=new Set(["https://osvaldosereia.github.io","https://cdsb.net.br","https://www.cdsb.net.br"]);
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("Origin")||"";
 const headers={
  "Access-Control-Allow-Origin":origins.has(origin)?origin:"null",
  "Vary":"Origin","Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type",
  "Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"
 };
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST"||!origins.has(origin))return reply({error:"Operação não permitida"},403);
 try{
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!jwt)return reply({error:"Faça login como administrador"},401);
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,
   secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const publicClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await publicClient.auth.getUser(jwt);
  if(authError||!user)return reply({error:"Sua sessão expirou"},401);
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:admin,error:checkError}=await db.from("staff_profiles").select("id,role,active,archived_at")
   .eq("id",user.id).maybeSingle();
  if(checkError||admin?.role!=="admin"||!admin?.active||admin.archived_at)
   return reply({error:"Somente administrador CDSB ativo pode gerenciar contas"},403);
  const body=await req.json();
  const id=String(body?.user_id||"");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
   return reply({error:"Usuário inválido"},400);
  const action=String(body?.action||"");
  if(!["edit","archive","restore"].includes(action))return reply({error:"Ação inválida"},400);
  const {data:target,error:targetError}=await db.from("staff_profiles")
   .select("id,role,active,archived_at,full_name,username").eq("id",id).maybeSingle();
  if(targetError||!target)return reply({error:"Usuário não encontrado"},404);
  if(action==="edit"){
   if(target.archived_at)return reply({error:"Restaure a conta antes de editar"},400);
   const name=String(body?.full_name||"").trim();
   const username=String(body?.username||"").trim();
   if(name.length<2||name.length>120||!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(username))
    return reply({error:"Informe nome de 2 a 120 caracteres e usuário válido de 3 a 32 caracteres"},400);
   const {data:duplicates,error:dupError}=await db.from("staff_profiles")
    .select("id").ilike("username",username).neq("id",id).limit(1);
   if(dupError||duplicates?.length)return reply({error:dupError?"Não foi possível verificar usuário":"Esse nome de usuário já está em uso"},409);
   const {error:updateError}=await db.from("staff_profiles").update({full_name:name,username}).eq("id",id);
   if(updateError)return reply({error:updateError.code==="23505"?"Nome de usuário já cadastrado":"Não foi possível editar a conta"},400);
   const {error:metadataError}=await db.auth.admin.updateUserById(id,{user_metadata:{full_name:name}});
   if(metadataError)console.error("Metadata update",metadataError.message);
   const {error:auditError}=await db.from("audit_log").insert({
    entity:"staff_profiles",entity_id:id,action:"STAFF_IDENTITY_EDITED",actor_id:user.id,
    details:{before:{name:target.full_name,username:target.username},after:{name,username}}
   });
   if(auditError)console.error("Audit failure",auditError.message);
   return reply({success:true,message:"Dados cadastrais atualizados"});
  }
  if(id===user.id)return reply({error:"Não é permitido excluir ou restaurar sua própria conta nesta tela"},400);
  if(action==="archive"){
   if(target.archived_at)return reply({error:"Esta conta já está arquivada"},400);
   if(body?.confirm!=="EXCLUIR")return reply({error:"Confirme a exclusão segura da conta"},400);
   if(target.role==="admin"){
    const {count,error:countError}=await db.from("staff_profiles").select("id",{count:"exact",head:true})
     .eq("role","admin").eq("active",true).is("archived_at",null);
    if(countError||(count||0)<2)return reply({error:"Não é possível excluir o último administrador ativo"},400);
   }
   const {error:banError}=await db.auth.admin.updateUserById(id,{ban_duration:"876000h"});
   if(banError)return reply({error:"Não foi possível bloquear o login. Nenhuma conta foi arquivada"},500);
   const {error:updateError}=await db.from("staff_profiles")
    .update({active:false,archived_at:new Date().toISOString(),archived_by:user.id}).eq("id",id);
   if(updateError)return reply({error:"Conta bloqueada no Auth, mas não foi possível atualizar o cadastro. Revise manualmente antes de prosseguir"},500);
   const {error:auditError}=await db.from("audit_log").insert({
    entity:"staff_profiles",entity_id:id,action:"STAFF_ARCHIVED",actor_id:user.id,
    details:{full_name:target.full_name,username:target.username,history_preserved:true}
   });
   if(auditError)console.error("Archive audit",auditError.message);
   return reply({success:true,message:"Conta excluída da equipe e login bloqueado. Histórico preservado."});
  }
  if(!target.archived_at)return reply({error:"Esta conta não está arquivada"},400);
  const {error:unban}=await db.auth.admin.updateUserById(id,{ban_duration:"none"});
  if(unban)return reply({error:"Não foi possível liberar o login"},500);
  const {error:restoreError}=await db.from("staff_profiles")
   .update({active:true,archived_at:null,archived_by:null}).eq("id",id);
  if(restoreError)return reply({error:"Login liberado, mas cadastro não foi reativado. Revise manualmente."},500);
  const {error:auditError}=await db.from("audit_log").insert({
   entity:"staff_profiles",entity_id:id,action:"STAFF_RESTORED",actor_id:user.id,
   details:{full_name:target.full_name,username:target.username}
  });
  if(auditError)console.error("Restore audit",auditError.message);
  return reply({success:true,message:"Conta restaurada e login liberado"});
 }catch(error){
  console.error("CDSB user manager failure",error instanceof Error?error.message:"unknown");
  return reply({error:"Não foi possível concluir a operação. Tente novamente."},500);
 }
});