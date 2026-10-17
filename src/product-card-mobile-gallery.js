/* CDSB: deslize lateral entre fotos sem setas sobrepostas no card mobile.
   Usa as ações existentes e os URLs assinados já tratados pelo aplicativo. */
(()=>{
  let gesture=null;
  const observed=new WeakSet();
  const syncIndicators=gallery=>{
    const dots=gallery.closest('.grouped-inventory-photo')?.querySelectorAll('.product-gallery-indicator');
    if(!dots?.length)return;
    const index=Number(gallery.dataset.galleryIndex||0);
    dots.forEach((dot,i)=>dot.classList.toggle('is-active',i===index));
  };
  const watchGallery=gallery=>{
    if(observed.has(gallery))return;
    observed.add(gallery);
    new MutationObserver(()=>syncIndicators(gallery))
      .observe(gallery,{attributes:true,attributeFilter:['data-gallery-index']});
  };
  document.addEventListener('touchstart',event=>{
    gesture=null;
    if(event.touches.length!==1)return;
    const gallery=event.target.closest?.('.products-panel .product-card-v3 [data-product-gallery]');
    if(!gallery)return;
    watchGallery(gallery);
    gesture={gallery,x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  document.addEventListener('touchend',event=>{
    if(!gesture||event.changedTouches.length!==1)return;
    const {gallery,x,y}=gesture;
    gesture=null;
    if(!gallery.isConnected)return;
    const dx=event.changedTouches[0].clientX-x;
    const dy=event.changedTouches[0].clientY-y;
    if(Math.abs(dx)<35||Math.abs(dx)<Math.abs(dy)*1.3)return;
    const direction=dx<0?'product-gallery-next':'product-gallery-prev';
    gallery.querySelector('[data-action="'+direction+'"]')?.click();
  },{passive:true});
  document.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
})();
