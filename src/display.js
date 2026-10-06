const key='khp-display-v1';
let preferences={size:100,eye:false};
try{const saved=JSON.parse(localStorage.getItem(key));if([100,115,130,150].includes(saved?.size))preferences.size=saved.size;preferences.eye=saved?.eye===true;}catch{}
const controls=document.createElement('div');
controls.className='display-controls';
controls.innerHTML='<label for="font-size">ขนาดตัวอักษร <select id="font-size" aria-label="ขนาดตัวอักษร"><option value="100">100% ปกติ</option><option value="115">115% ใหญ่</option><option value="130">130% ใหญ่มาก</option><option value="150">150% ใหญ่พิเศษ</option></select></label><button id="eye-mode" aria-pressed="false">◐ ถนอมสายตา</button>';
document.querySelector('.header-actions').prepend(controls);
const size=controls.querySelector('select'),eye=controls.querySelector('button');
function apply(){document.documentElement.style.fontSize=`${14*preferences.size/100}px`;document.documentElement.style.setProperty('--reading-scale',preferences.size/100);document.documentElement.classList.toggle('eye-mode',preferences.eye);size.value=preferences.size;eye.setAttribute('aria-pressed',String(preferences.eye));eye.textContent=preferences.eye?'◐ ถนอมสายตา: เปิด':'◐ ถนอมสายตา';try{localStorage.setItem(key,JSON.stringify(preferences));}catch{}}
size.addEventListener('change',()=>{preferences.size=Number(size.value);apply();});
eye.addEventListener('click',()=>{preferences.eye=!preferences.eye;apply();});
apply();
