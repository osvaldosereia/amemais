// Interrompe a aplicação quando o domínio de produção é aberto sem TLS.
// Não inicializa Supabase Auth nem solicita credenciais por HTTP.
const primary = 'cdsb.net.br';
const hosts = new Set([primary, 'www.'+primary]);
const insecure = hosts.has(window.location.hostname.toLowerCase()) && window.location.protocol !== 'https:';
if (insecure) {
  const element = document.querySelector('#app');
  element.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;padding:18px;background:#f6f8f7;color:#1a3028">
    <section style="background:#fff;max-width:430px;width:100%;border:1px solid #e0e6e2;padding:28px;border-radius:14px;font-family:system-ui,sans-serif">
      <h1 style="font-size:24px;margin:0 0 14px">AME MAIS — Conexão segura necessária</h1>
      <p style="line-height:1.6">O domínio foi aberto por HTTP. Por segurança, o sistema não recebe senhas nessa conexão.</p>
      <p><a href="https://cdsb.net.br/" style="display:block;text-align:center;background:#195c43;color:#fff;text-decoration:none;padding:14px 16px;border-radius:9px">Abrir o sistema com HTTPS</a></p>
      <p style="font-size:13px;line-height:1.6;color:#596a63">Caso o site seguro não abra, ative o certificado em GitHub → Settings → Pages → Enforce HTTPS. Aguarde a conclusão da configuração do domínio.</p>
    </section>
  </main>`;
} else {
  await import('./app.js?v=20261027catalogrecovery1');
  await import('./catalog-transfer.js?v=20261022importnew1');
}
