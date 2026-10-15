import {createClient} from "npm:@supabase/supabase-js@2.49.1";
const headers={
 "Access-Control-Allow-Origin":"https://osvaldosereia.github.io",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type",
 "Content-Type":"application/json"
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const roles=[
 {username:"cdsb.admin",full_name:"Administrador CDSB",role:"admin",store_code:null,
  permissions:["products.read","orders.read","users.manage","stores.manage","events.manage"]},
 {username:"cristorei.cuiaba",full_name:"Loja Cristo Rei Cuiabá",role:"franquia",store_code:"CRISTOREICBA",
  permissions:["products.read","orders.franchise"]},
 {username:"franquia.pocone",full_name:"Franquia Poconé - MT",role:"franquia",store_code:"FRANQPOCONE",
  permissions:["products.read","orders.franchise"]},
 {username:"franquia.borborema",full_name:"Franquia Borborema - SP",role:"franquia",store_code:"FRANQBORBOREMA",
  permissions:["products.read","orders.franchise"]},
 {username:"franquia.souza",full_name:"Franquia Souza - Paraíba",role:"franquia",store_code:"FRANQSOUZA",
  permissions:["products.read","orders.franchise"]},
 {username:"cdsb.separador",full_name:"Separador CDSB",role:"estoquista",store_code:"CDSB",
  permissions:["products.read","orders.read","orders.separate"]}
];
function randomPassword(){
 const bytes=new Uint8Array(27);crypto.getRandomValues(bytes);
 return btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")+"aA7!";
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return json({error:"Método não permitido"},405);
 if(!["https://osvaldosereia.github.io","https://cdsb.net.br"].includes(req.headers.get("Origin")||""))
  return json({error:"Origem não autorizada"},403);
 try{
  const auth=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!auth)return json({error:"Faça login como administrador"},401);
  const url=Deno.env.get("SUPABASE_URL")!,pub=Deno.env.get("SUPABASE_ANON_KEY")!,
   secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
  const client=createClient(url,pub,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:who}=await client.auth.getUser(auth);
  if(who||!user)return json({error:"Sessão inválida"},401);
  const {data:operator}=await db.from("staff_profiles").select("role,active").eq("id",user.id).maybeSingle();
  if(!operator?.active||operator.role!=="admin")return json({error:"Somente administrador CDSB"},403);
  const {action,confirm}=await req.json();
  if(action!=="provision-defaults"||confirm!=="CRIAR_CONTAS_CDSB")
   return json({error:"Confirmação necessária"},400);
  const {data:stores,error:storeError}=await db.from("stores").select("id,code,kind,is_primary,active").eq("active",true);
  if(storeError)return json({error:"Não foi possível conferir os destinos"},500);
  const byCode=new Map((stores||[]).map(s=>[s.code,s]));
  const primary=stores?.find(s=>s.is_primary);
  if(!primary||roles.some(r=>r.store_code&&!((r.store_code==="CDSB"?primary:byCode.get(r.store_code))?.id)))
   return json({error:"Cadastre o CDSB e todas as lojas antes de criar os acessos"},400);
  const output:Array<{username:string;full_name:string;password?:string;status:string}>=[];
  for(const preset of roles){
   const {data:existing,error:lookupError}=await db.from("staff_profiles").select("id").eq("username",preset.username).maybeSingle();
   if(lookupError)throw Error("Falha na consulta de usuários");
   if(existing){output.push({username:preset.username,full_name:preset.full_name,status:"já existe; use Redefinir senha"});continue;}
   const password=randomPassword(),email=preset.username+"@login.amemais.invalid";
   const {data:created,error:authError}=await db.auth.admin.createUser({
    email,password,email_confirm:true,user_metadata:{full_name:preset.full_name}
   });
   if(authError||!created.user)throw Error("Não foi possível criar: "+preset.full_name);
   const id=created.user.id;
   try{
    const {error:p}=await db.from("staff_profiles").insert({
     id,username:preset.username,full_name:preset.full_name,email,
     role:preset.role,active:true,permissions_customized:true
    });
    if(p)throw p;
    const {error:pe}=await db.from("staff_permissions").insert(
     preset.permissions.map(permission=>({user_id:id,permission})));
    if(pe)throw pe;
    const store=preset.store_code==="CDSB"?primary:byCode.get(preset.store_code||"");
    if(store){
     const {error:st}=await db.from("staff_stores").insert({user_id:id,store_id:store.id});
     if(st)throw st;
    }
    const {error:audit}=await db.from("audit_log").insert({
     entity:"staff_profiles",entity_id:id,action:"CDSB_INITIAL_ACCESS_CREATED",
     actor_id:user.id,details:{username:preset.username,profile:preset.role,store:preset.store_code}
    });
    if(audit)throw audit;
    output.push({username:preset.username,full_name:preset.full_name,password,status:"criado"});
   }catch(error){
    await db.from("staff_stores").delete().eq("user_id",id);
    await db.from("staff_permissions").delete().eq("user_id",id);
    await db.from("staff_profiles").delete().eq("id",id);
    await db.auth.admin.deleteUser(id);
    throw Error("Falha ao provisionar "+preset.full_name);
   }
  }
  return json({success:true,accounts:output,notice:"Senhas exibidas uma única vez. Entregue individualmente por canal seguro."});
 }catch(err){
  return json({error:err instanceof Error?err.message:"Erro ao preparar acessos. Contas concluídas podem ser revisadas em Usuários."},500);
 }
});