// ===== LIBRARY =====
let libraryCheckpoints = [];
let libraryLoras = [];
let currentLibType = 'checkpoint';
let currentLibKey = null;
let libraryMemos = JSON.parse(localStorage.getItem('ink_lib_memos')||'{}');
let libraryComboMemos = JSON.parse(localStorage.getItem('ink_lib_combo')||'[]');

function saveLibMemos(){ localStorage.setItem('ink_lib_memos', JSON.stringify(libraryMemos)); }
function saveLibCombo(){ localStorage.setItem('ink_lib_combo', JSON.stringify(libraryComboMemos)); }

// MDを読み込んでパース（初回のみ）
let libraryLoaded = false;
async function loadLibrary(){
  // 既に読み込み済みならスキップ
  if(libraryLoaded && libraryCheckpoints.length > 0){
    renderLibraryList();
    return;
  }

  const pinned = document.getElementById('pinned-checkpoint-content');
  if(pinned) pinned.innerHTML = '読み込み中...';

  // tips.md → 上部ピン留め
  try{
    const tipsRes = await fetch('./tips.md');
    if(tipsRes.ok){
      const tipsMd = await tipsRes.text();
      const allHtml = marked.parse(tipsMd);
      if(pinned) pinned.innerHTML = allHtml;
    } else {
      if(pinned) pinned.innerHTML = `<span style="color:#e05555;">tips.md が見つかりません（${tipsRes.status}）<br>HTMLと同じフォルダに配置してください</span>`;
    }
  } catch(e){
    if(pinned) pinned.innerHTML = `<span style="color:#e05555;">tips.md 読み込みエラー: ${e.message}</span>`;
    console.error('tips.md load failed:', e);
  }

  // checkpoints_guide.md → Checkpoint図鑑
  try{
    const ckRes = await fetch('./checkpoints_guide.md');
    if(ckRes.ok){
      libraryCheckpoints = parseMdModels(await ckRes.text());
      console.log(`[Library] Checkpoints loaded: ${libraryCheckpoints.length}`);
    } else {
      setLog(`checkpoints_guide.md が見つかりません（${ckRes.status}）`, 'error');
    }
  } catch(e){
    console.error('checkpoints_guide.md load failed:', e);
    setLog('checkpoints_guide.md 読み込みエラー: '+e.message, 'error');
  }

  // lora_guide.md → LoRA図鑑
  try{
    const loraRes = await fetch('./lora_guide.md');
    if(loraRes.ok){
      libraryLoras = parseMdModels(await loraRes.text());
      console.log(`[Library] LoRAs loaded: ${libraryLoras.length}`);
    } else {
      setLog(`lora_guide.md が見つかりません（${loraRes.status}）`, 'error');
    }
  } catch(e){
    console.error('lora_guide.md load failed:', e);
    setLog('lora_guide.md 読み込みエラー: '+e.message, 'error');
  }

  libraryLoaded = true;
  renderLibraryList();
  populateComboSelects();
}

// MDからモデル情報をパース（#### モデル名 形式）
function parseMdModels(md){
  const models = [];
  const blocks = md.split(/^#### /m).slice(1);
  for(const block of blocks){
    const lines = block.trim().split('\n');
    const name = lines[0].trim();
    const fields = {};
    for(const line of lines.slice(1)){
      const m = line.match(/^- \*\*(.+?)\*\*[：:]\s*(.+)/);
      if(m) fields[m[1].trim()] = m[2].trim();
    }
    models.push({name, fields});
  }
  return models;
}

// プルダウン選択時の処理
function onLibCkptChange(){
  const name = document.getElementById('lib-ckpt-select').value;
  const box = document.getElementById('lib-ckpt-detail');
  const memo = document.getElementById('lib-ckpt-memo');
  const label = document.getElementById('ckpt-memo-label');
  if(!name){
    box.innerHTML = '<div class="lib-detail-placeholder">Checkpointを選択してください</div>';
    memo.value=''; memo.disabled=true;
    label.textContent='📝 Checkpoint メモ';
    return;
  }
  const model = libraryCheckpoints.find(m=>m.name===name);
  if(model) renderDetailBox(box, model);
  const memoKey = 'checkpoint:'+name;
  memo.value = libraryMemos[memoKey]||'';
  memo.disabled = false;
  memo.placeholder = '使ってみた感想、相性の良いLoRA、失敗したプロンプトなど...';
  label.textContent = `📝 ${name} メモ`;
}

function onLibLoraChange(){
  const name = document.getElementById('lib-lora-select').value;
  const box = document.getElementById('lib-lora-detail');
  const memo = document.getElementById('lib-lora-memo');
  const label = document.getElementById('lora-memo-label');
  if(!name){
    box.innerHTML = '<div class="lib-detail-placeholder">LoRAを選択してください</div>';
    memo.value=''; memo.disabled=true;
    label.textContent='📝 LoRA メモ';
    return;
  }
  const model = libraryLoras.find(m=>m.name===name);
  if(model) renderDetailBox(box, model);
  const memoKey = 'lora:'+name;
  memo.value = libraryMemos[memoKey]||'';
  memo.disabled = false;
  memo.placeholder = '使ってみた感想、相性の良いCheckpoint、推奨強度など...';
  label.textContent = `📝 ${name} メモ`;
}

function renderDetailBox(box, model){
  const fieldsHtml = Object.entries(model.fields).map(([k,v])=>
    `<div class="lib-detail-key">${k}</div><div class="lib-detail-val">${v}</div>`
  ).join('');
  box.innerHTML = `<div class="lib-detail-title">${model.name}</div>
    <div class="lib-detail-fields">${fieldsHtml}</div>`;
}

function saveLibMemoFromInput(type){
  const el = document.getElementById('lib-'+type+'-memo');
  const sel = document.getElementById('lib-'+type+'-select');
  if(!el||!sel||!sel.value) return;
  const key = type+':'+sel.value;
  libraryMemos[key] = el.value;
  saveLibMemos();
}

// 旧関数（互換性のため残す）
function switchLibType(){}
function filterLibraryList(){}
function renderLibraryList(){}
function openLibraryItem(){}
function saveLibMemo(key,val){ libraryMemos[key]=val; saveLibMemos(); }

// 組み合わせメモ
function populateComboSelects(){
  // 図鑑プルダウン
  const libCkSel = document.getElementById('lib-ckpt-select');
  const libLoraSel = document.getElementById('lib-lora-select');
  if(libCkSel) libCkSel.innerHTML = '<option value="">── 選択してください ──</option>' +
    libraryCheckpoints.map(m=>`<option value="${m.name}">${m.name}</option>`).join('');
  if(libLoraSel) libLoraSel.innerHTML = '<option value="">── 選択してください ──</option>' +
    libraryLoras.map(m=>`<option value="${m.name}">${m.name}</option>`).join('');
  // 組み合わせプルダウン
  const ckSel = document.getElementById('combo-ckpt-select');
  const loraSel = document.getElementById('combo-lora-select');
  if(ckSel) ckSel.innerHTML = '<option value="">Checkpoint を選択...</option>' +
    libraryCheckpoints.map(m=>`<option value="${m.name}">${m.name}</option>`).join('');
  if(loraSel) loraSel.innerHTML = '<option value="">LoRA を選択（任意）...</option>' +
    libraryLoras.map(m=>`<option value="${m.name}">${m.name}</option>`).join('');
}

function renderComboView(){
  const list = document.getElementById('lib-combo-list');
  if(!list) return;
  const ckVal = document.getElementById('combo-ckpt-select')?.value || '';
  const loraVal = document.getElementById('combo-lora-select')?.value || '';
  const filtered = libraryComboMemos.filter(m=>
    (!ckVal || m.ckpt === ckVal) && (!loraVal || m.lora === loraVal)
  );
  list.innerHTML = filtered.length ? filtered.map(m=>`
    <div class="lib-combo-card">
      <div class="lib-combo-card-header">
        <div class="lib-combo-card-title">${m.ckpt} × ${m.lora||'(LoRAなし)'}</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <div class="lib-combo-card-date">${m.date}</div>
          <button class="lib-combo-card-del" onclick="deleteComboMemo(${m.id})">✕</button>
        </div>
      </div>
      <div class="lib-combo-card-text">${m.text}</div>
    </div>`).join('') :
    '<div style="color:var(--ink-600);font-size:.72rem;">まだメモがありません</div>';
}

function addComboMemo(){
  const ckpt = document.getElementById('combo-ckpt-select')?.value;
  const lora = document.getElementById('combo-lora-select')?.value;
  const text = document.getElementById('combo-memo-input')?.value.trim();
  if(!ckpt){ setLog('Checkpointを選択してください','error'); return; }
  if(!text){ setLog('メモを入力してください','error'); return; }
  libraryComboMemos.unshift({
    id: Date.now(),
    ckpt, lora,
    text,
    date: new Date().toLocaleDateString('ja-JP')
  });
  saveLibCombo();
  document.getElementById('combo-memo-input').value = '';
  renderComboView();
  setLog('組み合わせメモを保存しました','success');
}

function deleteComboMemo(id){
  if(!confirm('このメモを削除しますか？')) return;
  libraryComboMemos = libraryComboMemos.filter(m=>m.id!==id);
  saveLibCombo();
  renderComboView();
}
