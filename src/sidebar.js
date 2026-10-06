const sidebar=document.getElementById('sidebar'),overlay=document.getElementById('overlay'),toggle=document.getElementById('menu-toggle');
const compact=matchMedia('(max-width:1024px)');
let collapsed=false,drawer=false;
try{collapsed=localStorage.getItem('khp-sidebar-collapsed')==='true';}catch{}
const close=document.createElement('button');close.id='sidebar-close';close.className='icon-button';close.textContent='×';close.setAttribute('aria-label','ซ่อนเมนูด้านซ้าย');sidebar.prepend(close);
toggle.setAttribute('aria-controls','sidebar');
function apply(){
 const visible=compact.matches?drawer:!collapsed;
 document.documentElement.classList.toggle('sidebar-collapsed',!compact.matches&&collapsed);
 document.body.classList.toggle('drawer-open',compact.matches&&drawer);
 sidebar.classList.toggle('open',compact.matches&&drawer);sidebar.inert=!visible;
 overlay.hidden=!(compact.matches&&drawer);
 toggle.setAttribute('aria-expanded',String(visible));toggle.setAttribute('aria-label',visible?'ซ่อนเมนูด้านซ้าย':'แสดงเมนูด้านซ้าย');toggle.title=visible?'ซ่อนเมนู':'แสดงเมนู';
 document.querySelector('.workspace').inert=compact.matches&&drawer;
}
export function closeSidebar(restoreFocus=true){
 if(!compact.matches)return;
 drawer=false;apply();if(restoreFocus)toggle.focus();else if(sidebar.contains(document.activeElement))document.getElementById('content').focus();
}
function hide(){if(compact.matches)closeSidebar();else{collapsed=true;try{localStorage.setItem('khp-sidebar-collapsed','true');}catch{}apply();toggle.focus();}}
toggle.addEventListener('click',()=>{if(compact.matches){drawer=!drawer;apply();if(drawer)close.focus();}else{collapsed=!collapsed;try{localStorage.setItem('khp-sidebar-collapsed',String(collapsed));}catch{}apply();}});
close.addEventListener('click',hide);overlay.addEventListener('click',()=>closeSidebar());
compact.addEventListener('change',()=>{drawer=false;apply();});
document.addEventListener('keydown',event=>{
 if(!compact.matches||!drawer)return;
 if(event.key==='Escape'){event.preventDefault();closeSidebar();}
 if(event.key==='Tab'){const items=[...sidebar.querySelectorAll('button,a[href]')].filter(el=>!el.disabled);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
apply();
