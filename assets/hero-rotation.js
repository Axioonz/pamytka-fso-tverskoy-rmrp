/* Главная: слайдер разделов с паузой при взаимодействии. */
(()=>{
  'use strict';
  const root=document.getElementById('nv-hero-carousel');
  if(!root)return;
  const slides=[...root.querySelectorAll('[data-hero-slide]')];
  const controls=[...root.querySelectorAll('[data-hero-index]')];
  if(slides.length<2 || controls.length!==slides.length)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const home=document.getElementById('home-screen');
  let index=0, timer=null, onscreen=true;
  const interval=7000;
  function show(next){
    index=(next+slides.length)%slides.length;
    slides.forEach((slide,i)=>{
      const active=i===index;
      slide.classList.toggle('is-active',active);
      slide.inert=!active;
      slide.setAttribute('aria-hidden',String(!active));
    });
    controls.forEach((button,i)=>{
      const active=i===index;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
      if(active)button.setAttribute('aria-current','true');
      else button.removeAttribute('aria-current');
    });
  }
  function stop(){if(timer!==null){window.clearInterval(timer);timer=null}}
  function canPlay(){
    return !reduced.matches && !document.hidden && onscreen &&
      !home?.hidden && !root.matches(':hover') && !root.contains(document.activeElement);
  }
  function sync(){
    stop();
    if(canPlay())timer=window.setInterval(()=>show(index+1),interval);
  }
  controls.forEach(button=>button.addEventListener('click',()=>{
    show(Number(button.dataset.heroIndex));
    sync();
  }));
  root.addEventListener('mouseenter',sync);
  root.addEventListener('mouseleave',sync);
  root.addEventListener('focusin',sync);
  root.addEventListener('focusout',()=>window.setTimeout(sync,0));
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pageshow',sync);
  reduced.addEventListener?.('change',sync);
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      onscreen=Boolean(entries[0]?.isIntersecting);
      sync();
    },{threshold:.15});
    observer.observe(root);
  }
  let touchX=null,touchY=null;
  root.addEventListener('touchstart',event=>{
    if(event.touches.length!==1)return;
    touchX=event.touches[0].clientX;
    touchY=event.touches[0].clientY;
  },{passive:true});
  root.addEventListener('touchend',event=>{
    if(touchX===null || !event.changedTouches.length)return;
    const dx=event.changedTouches[0].clientX-touchX;
    const dy=event.changedTouches[0].clientY-touchY;
    touchX=touchY=null;
    if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.4){
      show(index+(dx<0?1:-1));
      sync();
    }
  },{passive:true});

  // Загружаем реальные фотографии отдельно, чтобы при сетевой ошибке
  // карточка всё равно показывала существующую локальную подложку.
  for(const slide of slides){
    const source=slide.dataset.heroPhoto;
    if(!source)continue;
    const photo=new Image();
    photo.decoding='async';
    photo.onload=()=>{
      if(slide.isConnected)slide.style.setProperty('--nv-hero-image','url("'+source+'")');
    };
    photo.onerror=()=>console.warn('Не загружена фотография Кремля:',source);
    photo.src=source;
  }

  show(0);
  sync();
})();
