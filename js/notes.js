// ===== TAG LIBRARY =====
let tagLibrary = JSON.parse(localStorage.getItem('ink_tags')||'[]');
let currentTagCatId = null;

function saveTagLibrary(){ localStorage.setItem('ink_tags', JSON.stringify(tagLibrary)); }

function renderTagCategoryList(){
  const el = document.getElementById('tag-category-list');
  if(!el) return;
  el.innerHTML = tagLibrary.map(cat=>`
    <div class="tag-category-item${cat.id===currentTagCatId?' active':''}" onclick="openTagCategory('${cat.id}')">
      ${escapeHtml(cat.name||'無名カテゴリ')}
    </div>`).join('');
  renderTagBuilderArea();
}

function newTagCategory(){
  const cat = {
    id: Date.now().toString(),
    name: '新規カテゴリ',
    tags: []
  };
  tagLibrary.push(cat);
  saveTagLibrary();
  renderTagCategoryList();
  openTagCategory(cat.id);
}

function openTagCategory(id){
  currentTagCatId = id;
  currentCharaId = null;
  currentNoteId = null;
  const cat = tagLibrary.find(c=>c.id===id);
  if(!cat) return;
  renderTagCategoryList();
  // 右エディタに表示
  const ce = document.getElementById('chara-editor');
  const ne = document.getElementById('notes-editor');
  ce.style.display='flex'; ce.style.flexDirection='column';
  ne.style.display='none';
  ce.innerHTML = `
    <div class="tag-editor-header">
      <input class="tag-editor-cat-name" id="tag-cat-name"
        value="${escapeHtml(cat.name)}"
        oninput="updateTagCatName(this.value)"
        placeholder="カテゴリ名（例：構図、雰囲気）">
      <div style="display:flex;justify-content:flex-end;margin-top:8px;">
        <button class="btn-delete-note" onclick="deleteTagCategory('${cat.id}')">🗑 カテゴリ削除</button>
      </div>
    </div>
    <div class="tag-list-area" id="tag-list-area">
      ${renderTagItems(cat)}
    </div>
    <div style="padding:0 18px 14px;">
      <button class="btn-add-tag" onclick="addTagItem('${cat.id}')">＋ タグを追加</button>
    </div>`;
}

function renderTagItems(cat){
  return cat.tags.map((tag,i)=>`
    <div class="tag-item-col" id="tag-row-${i}">
      <div class="tag-item-row">
        <input class="tag-item-name" value="${escapeHtml(tag.name)}"
          oninput="updateTagItem('${cat.id}',${i},'name',this.value)"
          placeholder="表示名（例：全身立ち）">
        <button class="tag-item-del" onclick="deleteTagItem('${cat.id}',${i})">✕</button>
      </div>
      <div class="tag-item-prompt-row">
        <input class="tag-item-prompt" id="tag-prompt-${cat.id}-${i}"
          value="${escapeHtml(tag.prompt)}"
          oninput="updateTagItem('${cat.id}',${i},'prompt',this.value)"
          placeholder="英語タグ（例：full body, standing）または日本語でもOK">
        <button class="btn-translate tag-translate-btn"
          onclick="translateTagPrompt('${cat.id}',${i})"
          title="日本語→英語に変換">🇯🇵</button>
      </div>
    </div>`).join('');
}

function updateTagCatName(val){
  const cat = tagLibrary.find(c=>c.id===currentTagCatId);
  if(!cat) return;
  cat.name = val;
  saveTagLibrary();
  renderTagCategoryList();
}

function addTagItem(catId){
  const cat = tagLibrary.find(c=>c.id===catId);
  if(!cat) return;
  cat.tags.push({name:'', prompt:''});
  saveTagLibrary();
  const area = document.getElementById('tag-list-area');
  if(area) area.innerHTML = renderTagItems(cat);
}

function updateTagItem(catId, idx, field, val){
  const cat = tagLibrary.find(c=>c.id===catId);
  if(!cat || !cat.tags[idx]) return;
  cat.tags[idx][field] = val;
  saveTagLibrary();
  renderTagBuilderArea();
}

function deleteTagItem(catId, idx){
  const cat = tagLibrary.find(c=>c.id===catId);
  if(!cat) return;
  cat.tags.splice(idx,1);
  saveTagLibrary();
  const area = document.getElementById('tag-list-area');
  if(area) area.innerHTML = renderTagItems(cat);
  renderTagBuilderArea();
}

async function translateTagPrompt(catId, idx){
  const inputId = `tag-prompt-${catId}-${idx}`;
  const el = document.getElementById(inputId);
  if(!el) return;
  const text = el.value.trim();
  if(!text){ setLog('翻訳するテキストがありません','error'); return; }
  // 日本語チェック
  const hasJapanese = /[\u3040-\u30FF\u3400-\u9FFF\uFF00-\uFFEF]/.test(text);
  if(!hasJapanese){ setLog('日本語が含まれていません',''); return; }
  const btn = el.nextElementSibling;
  if(btn){ btn.classList.add('translating'); btn.textContent='...'; }
  setLog('タグを翻訳中...','');
  const systemPrompt = `Convert Japanese text to Stable Diffusion prompt tags. Output ONLY comma-separated English tags, nothing else.`;
  try{
    const res = await fetch(`${OLLAMA_URL}/api/generate`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:ollamaModel, prompt:`Convert to SD tags: ${text}`, system:systemPrompt, stream:false, options:{temperature:0.2,num_predict:80}})
    });
    if(!res.ok) throw new Error(`Ollama ${res.status}`);
    const data = await res.json();
    const translated = data.response?.trim();
    if(!translated) throw new Error('空のレスポンス');
    el.value = translated;
    // updateTagItemを手動で呼ぶ
    updateTagItem(catId, idx, 'prompt', translated);
    setLog(`タグ翻訳完了: ${translated.slice(0,50)}`,'success');
  }catch(e){
    setLog('翻訳失敗: '+e.message,'error');
  }finally{
    if(btn){ btn.classList.remove('translating'); btn.textContent='🇯🇵'; }
  }
}

function deleteTagCategory(id){
  if(!confirm('このカテゴリを削除しますか？')) return;
  tagLibrary = tagLibrary.filter(c=>c.id!==id);
  currentTagCatId = null;
  saveTagLibrary();
  renderTagCategoryList();
  const ce = document.getElementById('chara-editor');
  ce.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;"><span style="color:var(--ink-600);font-size:.72rem;">カテゴリを選択または新規作成</span></div>';
}

function renderTagBuilderArea(){
  const area = document.getElementById('tag-library-area');
  if(!area || tagLibrary.length===0) { if(area) area.innerHTML=''; return; }
  area.innerHTML = tagLibrary.map(cat=>{
    const tags = cat.tags.filter(t=>t.name&&t.prompt);
    if(!tags.length) return '';
    return `<div class="tag-builder-section">
      <div class="tag-builder-cat-label">${escapeHtml(cat.name)}</div>
      <div class="tag-builder-buttons">
        ${tags.map(t=>`<button class="tag-builder-btn"
          onclick="toggleTagBtn(this,'${escapeHtml(t.prompt)}')"
          title="${escapeHtml(t.prompt)}">${escapeHtml(t.name)}</button>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function toggleTagBtn(btn, prompt){
  btn.classList.toggle('selected');
  // イベント欄に追記または削除
  const el = document.getElementById('builder-event');
  if(!el) return;
  const current = el.value;
  if(btn.classList.contains('selected')){
    el.value = current ? current + ', ' + prompt : prompt;
  } else {
    // 該当タグを除去
    const parts = current.split(',').map(s=>s.trim()).filter(s=>s!==prompt);
    el.value = parts.join(', ');
  }
}


// ===== CHARA STORE =====
let charaList = JSON.parse(localStorage.getItem('ink_charas')||'[]');
let currentCharaId = null;

function saveCharas(){ localStorage.setItem('ink_charas', JSON.stringify(charaList)); }

function renderCharaList(){
  const el = document.getElementById('chara-list');
  if(!el) return;
  el.innerHTML = '';
  charaList.forEach(c=>{
    const item = document.createElement('div');
    item.className = 'note-item' + (c.id===currentCharaId?' active':'');
    item.innerHTML = `<div class="note-item-title">${c.name||'無名キャラ'}</div>`;
    item.onclick = ()=>openChara(c.id);
    el.appendChild(item);
  });
  // Builderのセレクトも更新
  const sel = document.getElementById('builder-chara');
  if(!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">── 選択してください ──</option>';
  charaList.forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name||'無名キャラ';
    sel.appendChild(opt);
  });
  sel.value = prev;
}

function newChara(){
  const c = {
    id: Date.now().toString(),
    name: '新規キャラ',
    positive: '',
    negative: '',
    checkpoint: '',
    lora: ''
  };
  charaList.push(c);
  saveCharas();
  renderCharaList();
  openChara(c.id);
}

function openChara(id){
  currentCharaId = id;
  currentNoteId = null;
  const c = charaList.find(x=>x.id===id);
  if(!c) return;
  renderCharaList();
  renderNotesList();
  // 右エディタ切り替え
  document.getElementById('chara-editor').style.display='flex';
  document.getElementById('notes-editor').style.display='none';
  const editor = document.getElementById('chara-editor');
  editor.innerHTML = `
    <input class="note-title-input" id="chara-name" value="${escapeHtml(c.name||'')}" oninput="updateCharaField('name',this.value)" placeholder="キャラ名">
    <div class="prompt-label-row"><div class="note-section-label">Positive</div><button class="btn-translate" onclick="translatePrompt('chara-pos')">🇯🇵 → EN</button></div>
    <textarea class="note-textarea" id="chara-pos" rows="5" oninput="updateCharaField('positive',this.value)" placeholder="キャラのベースプロンプト（日本語でもOK）">${escapeHtml(c.positive||'')}</textarea>
    <div class="prompt-label-row"><div class="note-section-label">Negative</div><button class="btn-translate" onclick="translatePrompt('chara-neg')">🇯🇵 → EN</button></div>
    <textarea class="note-textarea" id="chara-neg" rows="3" oninput="updateCharaField('negative',this.value)" placeholder="除外タグ（日本語でもOK）">${escapeHtml(c.negative||'')}</textarea>
    <div class="note-section-label">Checkpoint</div>
    <select class="note-select" id="chara-ckpt" onchange="updateCharaField('checkpoint',this.value)">
      <option value="">── 指定なし ──</option>
      ${checkpointList.map(m=>`<option value="${m}" ${m===c.checkpoint?'selected':''}>${m}</option>`).join('')}
    </select>
    <div class="note-section-label">LoRA</div>
    <select class="note-select" id="chara-lora" onchange="updateCharaField('lora',this.value)">
      <option value="">なし</option>
      ${loraList.map(l=>`<option value="${l}" ${l===c.lora?'selected':''}>${l}</option>`).join('')}
    </select>
    <div class="note-actions">
      <button class="btn-apply-note" onclick="applyCharaToGenerate('${c.id}')">▶ Generateに反映</button>
      <button class="btn-delete-note" onclick="deleteChara('${c.id}')">🗑 削除</button>
    </div>`;
}

function updateCharaField(field, val){
  const c = charaList.find(x=>x.id===currentCharaId);
  if(!c) return;
  c[field] = val;
  if(field==='name') renderCharaList();
  saveCharas();
}

function deleteChara(id){
  if(!confirm('このキャラ定義を削除しますか？')) return;
  charaList = charaList.filter(x=>x.id!==id);
  currentCharaId = null;
  saveCharas();
  renderCharaList();
  document.getElementById('chara-editor').innerHTML =
    '<div style="flex:1;display:flex;align-items:center;justify-content:center;"><span style="color:var(--ink-600);font-size:.72rem;">キャラを選択または新規作成</span></div>';
}

function applyCharaToGenerate(id){
  const c = charaList.find(x=>x.id===id);
  if(!c) return;
  if(c.positive) document.getElementById('positive-prompt').value = c.positive;
  if(c.negative) document.getElementById('negative-prompt').value = c.negative;
  if(c.checkpoint) document.getElementById('checkpoint-select').value = c.checkpoint;
  if(c.lora) document.getElementById('lora-select').value = c.lora;
  switchTab('generate');
  setLog(`キャラ「${c.name}」をGenerateに反映しました`,'success');
}

// switchNotesSubtab: 廃止（左パネル上下レイアウトに変更）

function onBuilderCharaChange(){
  // キャラ選択変更時は何もしない（反映ボタンで適用）
}

function applyBuilder(){
  const charaId = document.getElementById('builder-chara').value;
  const eventPrompt = document.getElementById('builder-event').value.trim();

  if(!charaId && !eventPrompt){
    setLog('キャラまたはイベントを入力してください','error'); return;
  }

  let pos = '';
  let neg = '';

  // Layer1: キャラ
  if(charaId){
    const c = charaList.find(x=>x.id===charaId);
    if(c){
      pos = c.positive || '';
      neg = c.negative || '';
      if(c.checkpoint) document.getElementById('checkpoint-select').value = c.checkpoint;
      if(c.lora) document.getElementById('lora-select').value = c.lora;
    }
  }

  // Layer2: フォーマット（activeFormatのタグを追加）
  if(activeFormat){
    const fmt = FORMAT_PRESETS[activeFormat];
    if(fmt && fmt.promptTag){
      pos = pos ? pos + ', ' + fmt.promptTag : fmt.promptTag;
    }
  }

  // Layer3: イベント
  if(eventPrompt){
    pos = pos ? pos + ', ' + eventPrompt : eventPrompt;
  }

  if(pos) document.getElementById('positive-prompt').value = pos;
  if(neg) document.getElementById('negative-prompt').value = neg;

  const charaName = charaId ? (charaList.find(x=>x.id===charaId)?.name||'') : '';
  setLog(`Builder反映：${charaName}${activeFormat?' × '+FORMAT_PRESETS[activeFormat].label:''}${eventPrompt?' × イベント':''}`,'success');
}
let selectedSize = {w:512,h:768};
let generateCount = 1;
let currentImageData = null;
let currentPromptPos = '';
let ws = null;
let promptId = null;
let refImageBase64 = null;
let startTime = null;
let elapsedTimer = null;
let hiddenItems = JSON.parse(localStorage.getItem('ink_hidden')||'[]');
let modalCurrentFile = null;
let modalCurrentPrompt = '';
let notes = JSON.parse(localStorage.getItem('ink_notes')||'[]');
let currentNoteId = null;
let checkpointList = [];
let loraList = [];


// ===== PROMPT NOTES =====
function syncNoteSelects(){
  // ノートエディタが開いていれば更新
  const cpSel=document.getElementById('note-checkpoint-sel');
  const loraSel=document.getElementById('note-lora-sel');
  if(cpSel){
    const cur=cpSel.value;
    cpSel.innerHTML=`<option value="">（未設定）</option>`+checkpointList.map(c=>`<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
  }
  if(loraSel){
    const cur=loraSel.value;
    loraSel.innerHTML=`<option value="">なし</option>`+loraList.map(l=>`<option value="${l}" ${l===cur?'selected':''}>${l}</option>`).join('');
  }
}

function renderNotesList(){
  const list=document.getElementById('notes-list');
  if(!notes.length){ list.innerHTML='<div style="padding:16px;font-family:\'JetBrains Mono\',monospace;font-size:.68rem;color:var(--ink-600);">ノートがありません</div>'; return; }
  list.innerHTML=notes.map(n=>`
    <div class="note-item ${n.id===currentNoteId?'active':''}" onclick="selectNote('${n.id}')">
      <div class="note-item-title">${escapeHtml(n.title||'無題')}</div>
      <div class="note-item-preview">${escapeHtml(n.positive||'...')}</div>
    </div>
  `).join('');
}

function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function newNote(){
  const note={id:Date.now().toString(),title:'新しいノート',positive:'',negative:'',checkpoint:'',lora:''};
  notes.unshift(note);
  saveNotes();
  selectNote(note.id);
}

function selectNote(id){
  currentNoteId=id;
  currentCharaId=null;
  const note=notes.find(n=>n.id===id);
  if(!note) return;
  renderNotesList();
  renderCharaList();
  // 右エディタ切り替え
  document.getElementById('chara-editor').style.display='none';
  const ne=document.getElementById('notes-editor');
  ne.style.display='flex';
  ne.style.flexDirection='column';
  ne.innerHTML=`
    <input class="note-title-input" id="note-title-input" value="${escapeHtml(note.title)}" oninput="updateNote('title',this.value)" placeholder="タイトル">

    <div><div class="prompt-label-row"><div class="note-section-label">Positive Prompt</div><button class="btn-translate" onclick="translatePrompt('note-pos')">🇯🇵 → EN</button></div>
    <textarea class="note-textarea" id="note-pos" rows="5" oninput="updateNote('positive',this.value)">${escapeHtml(note.positive)}</textarea></div>

    <div><div class="prompt-label-row"><div class="note-section-label">Negative Prompt</div><button class="btn-translate" onclick="translatePrompt('note-neg')">🇯🇵 → EN</button></div>
    <textarea class="note-textarea" id="note-neg" rows="3" oninput="updateNote('negative',this.value)">${escapeHtml(note.negative)}</textarea></div>

    <div><div class="note-section-label">Checkpoint</div>
    <select class="note-select" id="note-checkpoint-sel" onchange="updateNote('checkpoint',this.value)">
      <option value="">（未設定）</option>
      ${checkpointList.map(c=>`<option value="${c}" ${c===note.checkpoint?'selected':''}>${c}</option>`).join('')}
    </select></div>

    <div><div class="note-section-label">LoRA</div>
    <select class="note-select" id="note-lora-sel" onchange="updateNote('lora',this.value)">
      <option value="">なし</option>
      ${loraList.map(l=>`<option value="${l}" ${l===note.lora?'selected':''}>${l}</option>`).join('')}
    </select></div>

    <div class="note-actions">
      <button class="btn-use-prompt" onclick="applyNote()">▶ Generateに反映</button>
      <button class="btn-del-note" onclick="deleteNote()">削除</button>
    </div>
  `;
}

function updateNote(field, val){
  const note=notes.find(n=>n.id===currentNoteId);
  if(note){ note[field]=val; saveNotes(); renderNotesList(); }
}

function applyNote(){
  const note=notes.find(n=>n.id===currentNoteId);
  if(!note) return;
  if(note.positive) document.getElementById('positive-prompt').value=note.positive;
  if(note.negative) document.getElementById('negative-prompt').value=note.negative;
  if(note.checkpoint){
    const sel=document.getElementById('checkpoint-select');
    if([...sel.options].some(o=>o.value===note.checkpoint)) sel.value=note.checkpoint;
  }
  if(note.lora){
    const sel=document.getElementById('lora-select');
    if([...sel.options].some(o=>o.value===note.lora)){
      sel.value=note.lora;
      document.getElementById('lora-strength-row').style.display='grid';
    }
  }
  switchTab('generate');
  setLog(`「${note.title}」をGenerateに反映しました`,'success');
}

function deleteNote(){
  notes=notes.filter(n=>n.id!==currentNoteId);
  currentNoteId=null;
  saveNotes(); renderNotesList();
  document.getElementById('notes-editor').innerHTML='<div style="flex:1;display:flex;align-items:center;justify-content:center;"><span style="color:var(--ink-600);font-family:\'JetBrains Mono\',monospace;font-size:.72rem;">ノートを選択または新規作成</span></div>';
}

function saveNotes(){ localStorage.setItem('ink_notes',JSON.stringify(notes)); }
