// ===== GALLERY =====
const RECENT_OUTPUTS_KEY = 'ink_recent_outputs';
let recentGalleryItems = JSON.parse(localStorage.getItem(RECENT_OUTPUTS_KEY) || '[]');

function galleryKey(item){
  return `${item.filename}|${item.subfolder || ''}|${item.type || 'output'}`;
}

function normalizeGalleryItem(item){
  return {
    filename: item.filename,
    subfolder: item.subfolder || '',
    type: item.type || 'output',
    prompt: item.prompt || '',
    pid: item.pid || '',
    createdAt: item.createdAt || Date.now()
  };
}

function rememberGalleryItem(item){
  if(!item || !item.filename) return;
  const normalized = normalizeGalleryItem(item);
  const key = galleryKey(normalized);
  recentGalleryItems = [normalized, ...recentGalleryItems.filter(x => galleryKey(x) !== key)].slice(0, 200);
  localStorage.setItem(RECENT_OUTPUTS_KEY, JSON.stringify(recentGalleryItems));
}

function mergeGalleryItems(historyItems){
  const map = new Map();
  [...recentGalleryItems, ...historyItems].forEach(raw => {
    const item = normalizeGalleryItem(raw);
    if(hiddenItems.includes(item.filename)) return;
    if(!map.has(galleryKey(item))) map.set(galleryKey(item), item);
  });
  return [...map.values()];
}

async function loadGallery(showLog=false) {
  if(showLog) setLog('ギャラリーを更新中...','');
  try {
    let historyItems = [];

    // 1. Output API（output_api.py）からoutputフォルダを直接スキャン
    try {
      const apiRes = await fetch(`${OUTPUT_API_URL}/outputs?limit=500`, {signal: AbortSignal.timeout(3000)});
      if(apiRes.ok){
        const apiData = await apiRes.json();
        if(apiData.files && apiData.files.length > 0){
          historyItems = apiData.files
            .filter(f => !hiddenItems.includes(f.filename))
            .map(f => normalizeGalleryItem({...f, createdAt: f.mtime * 1000}));
        }
      }
    } catch(e) {
      // Output APIが使えない場合はhistoryにフォールバック
    }

    // 2. Output APIが空ならhistory APIにフォールバック
    if(historyItems.length === 0){
      try {
        const res = await fetch(`${COMFYUI_URL}/history?max_items=10000`);
        const data = await res.json();
        for (const pid in data) {
          const entry = data[pid];
          const outputs = entry.outputs || {};
          let posText = '';
          try {
            const promptNodes = entry.prompt[2] || {};
            for (const nid in promptNodes) {
              const node = promptNodes[nid];
              if (node.class_type === 'CLIPTextEncode') {
                const txt = node.inputs?.text || '';
                if (txt && !txt.includes('lowres') && !txt.includes('bad anatomy') && !txt.includes('bad hands')) {
                  posText = txt; break;
                }
              }
            }
          } catch(e) {}
          for (const nid in outputs) {
            const nodeOut = outputs[nid];
            if (nodeOut.images) {
              for (const img of nodeOut.images) {
                if (!hiddenItems.includes(img.filename)) {
                  historyItems.push(normalizeGalleryItem({...img, type: img.type||'output', prompt: posText, pid, createdAt: Date.now()}));
                }
              }
            }
          }
        }
        historyItems.reverse();
      } catch(e) {}
    }

    // 3. LocalStorageのrecentGalleryItemsと統合
    await renderGallery(mergeGalleryItems(historyItems));
    if(showLog) setLog(`ギャラリーを更新しました (${document.getElementById('stock-count').textContent}件)`,'success');
  } catch(e) {
    setLog('ギャラリーの読み込みに失敗: '+e.message,'error');
  }
}

async function renderGallery(items) {
  const grid = document.getElementById('gallery-grid');
  if (!items.length) {
    grid.innerHTML = '<div class="gallery-empty">画像がありません<br><span style="font-size:.62rem;opacity:.6;">Generateタブで画像を生成するか、↻ 更新を押してください</span></div>';
    return;
  }
  // ComfyUIの/viewは環境によってHEADが不安定なので、存在確認で弾かずそのまま描画する。
  const validItems = items.filter(item => item && item.filename && !hiddenItems.includes(item.filename));
  document.getElementById('stock-count').textContent = validItems.length;

  if (!validItems.length) {
    grid.innerHTML = '<div class="gallery-empty">画像がありません<br><span style="font-size:.62rem;opacity:.6;">Generateタブで画像を生成するか、↻ 更新を押してください</span></div>';
    return;
  }

  grid.innerHTML = validItems.map(item => {
    const url = `${COMFYUI_URL}/view?filename=${encodeURIComponent(item.filename)}&subfolder=${encodeURIComponent(item.subfolder||'')}&type=${item.type}`;
    const safePrompt = encodeURIComponent(item.prompt||'');
    return `<div class="gallery-item" onclick="openModal('${item.filename}','${encodeURIComponent(item.subfolder||'')}','${item.type}','${safePrompt}')">
      <img class="gallery-thumb" src="${url}" alt="${item.filename}" loading="lazy" onerror="this.closest('.gallery-item').style.display='none'">
      <div class="gallery-item-name">${item.filename}</div>
    </div>`;
  }).join('');
}


// ===== MODAL =====
function openModal(filename, subfolder, type, promptEncoded, seedVal) {
  modalCurrentFile = {filename, subfolder:decodeURIComponent(subfolder), type};
  modalCurrentPrompt = decodeURIComponent(promptEncoded);
  const url = `${COMFYUI_URL}/view?filename=${encodeURIComponent(filename)}&subfolder=${decodeURIComponent(subfolder)}&type=${type}`;
  document.getElementById('modal-img').src = url;
  document.getElementById('modal-title').textContent = filename;
  document.getElementById('modal-resize-w').value = '';
  document.getElementById('modal-resize-h').value = '';
  const area = document.getElementById('modal-prompt-area');
  let areaHtml = '';
  // Seedをファイル名から抽出（_sXXXXXX_ 形式）
  const seedMatch = filename.match(/_s(\d+)_/);
  const seed = seedVal || (seedMatch ? seedMatch[1] : null);
  if(seed){
    areaHtml += `<div class="modal-prompt-label">Seed</div>
      <div class="modal-prompt modal-seed" onclick="copyAndSetSeed(${seed})" title="クリックでSeed欄にセット" style="cursor:pointer;color:var(--amber);">
        🎲 ${seed} <span style="font-size:.65rem;opacity:.6;">（クリックでセット）</span>
      </div>`;
  }
  if (modalCurrentPrompt) {
    areaHtml += `<div class="modal-prompt-label">Positive Prompt</div><div class="modal-prompt">${modalCurrentPrompt}</div>`;
  }
  area.innerHTML = areaHtml;
  document.getElementById('modal-overlay').classList.add('active');
}

function closeModalBg(e) { if(e.target===document.getElementById('modal-overlay')) closeModalDirect(); }
function closeModalDirect() { document.getElementById('modal-overlay').classList.remove('active'); }

function downloadModal() {
  if (!modalCurrentFile) return;
  const url = `${COMFYUI_URL}/view?filename=${encodeURIComponent(modalCurrentFile.filename)}&subfolder=${encodeURIComponent(modalCurrentFile.subfolder)}&type=${modalCurrentFile.type}`;
  const a = document.createElement('a'); a.href=url; a.download=modalCurrentFile.filename; a.click();
}

async function downloadModalResized() {
  const w = parseInt(document.getElementById('modal-resize-w').value)||null;
  const h = parseInt(document.getElementById('modal-resize-h').value)||null;
  if (!w && !h) { downloadModal(); return; }
  const url = `${COMFYUI_URL}/view?filename=${encodeURIComponent(modalCurrentFile.filename)}&subfolder=${encodeURIComponent(modalCurrentFile.subfolder)}&type=${modalCurrentFile.type}`;
  await resizeAndDownload(url, w, h, `resized_${modalCurrentFile.filename}`);
}

function reusePrompt() {
  if (modalCurrentPrompt) {
    document.getElementById('positive-prompt').value = modalCurrentPrompt;
    switchTab('generate');
    setLog('プロンプトを再利用しました','success');
    closeModalDirect();
  }
}

function hideGalleryItem() {
  if (!modalCurrentFile) return;
  hiddenItems.push(modalCurrentFile.filename);
  localStorage.setItem('ink_hidden', JSON.stringify(hiddenItems));
  closeModalDirect();
  loadGallery(false);
  setLog(`${modalCurrentFile.filename} を非表示にしました`,'');
}
