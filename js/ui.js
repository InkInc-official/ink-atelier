function setSplash(pct, msg){
  document.getElementById('splash-bar').style.width = pct+'%';
  document.getElementById('splash-msg').textContent = msg;
}
function hideSplash(){
  const el = document.getElementById('splash');
  el.classList.add('hidden');
  setTimeout(()=>el.style.display='none', 700);
}


// ===== TABS =====
function switchTab(name){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  document.getElementById(`tab-btn-${name}`).classList.add('active');
  document.getElementById(`tab-${name}`).classList.add('active');
  if(name==='gallery') loadGallery(false);
  if(name==='library') loadLibrary();
}
// タブボタンのonclickも対応
document.getElementById('tab-btn-generate').onclick=()=>switchTab('generate');
document.getElementById('tab-btn-gallery').onclick=()=>switchTab('gallery');
document.getElementById('tab-btn-notes').onclick=()=>switchTab('notes');
document.getElementById('tab-btn-schedule').onclick=()=>switchTab('schedule');


// ===== UTILS =====
function resetUI(){ document.getElementById('spinner').style.display='none'; }
function setStatus(state,text){ document.getElementById('status-dot').className='status-dot '+state; document.getElementById('status-text').textContent=text; }
function setLog(msg,type){ document.getElementById('log-bar').className='log-bar '+(type||''); document.getElementById('log-msg').textContent=msg; }
