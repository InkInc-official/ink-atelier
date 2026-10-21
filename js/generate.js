function applyFormat(key){
  const p = FORMAT_PRESETS[key];
  // サイズのみ適用（Advanced: Steps / CFG / Sampler / Scheduler は変更しない）
  selectedSize = {w:p.w, h:p.h};
  document.getElementById('canvas-area') && (document.getElementById('canvas-area').style.aspectRatio = `${p.w}/${p.h}`);
  // サイズボタンのactiveを外す（フォーマット専用サイズ扱い）
  document.querySelectorAll('.size-btn').forEach(b=>b.classList.remove('active'));
  // フォーマットボタンのactive切り替え
  document.querySelectorAll('.format-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('fmt-'+key).classList.add('active');
  activeFormat = key;
  setLog(`フォーマット「${p.label}」適用：${p.w}×${p.h}（Advanced設定は維持）`,'success');
  setFormatLock(true);
}

function setFormatLock(locked){
  // Format選択時はSizeだけ固定。Advanced（Steps / CFG / Sampler / Scheduler）は常に手動変更可能。
  const targets = [
    ...document.querySelectorAll('.size-btn'),
    document.getElementById('custom-w'),
    document.getElementById('custom-h'),
  ].filter(Boolean);
  targets.forEach(el=>{
    el.disabled = locked;
    el.style.opacity = locked ? '0.35' : '1';
    el.style.pointerEvents = locked ? 'none' : '';
  });
  // フォーマット解除ボタンの表示切り替え
  const clearBtn = document.getElementById('fmt-clear-btn');
  if(clearBtn) clearBtn.style.display = locked ? 'block' : 'none';
}

function clearFormat(){
  activeFormat=null;
  document.querySelectorAll('.format-btn').forEach(b=>b.classList.remove('active'));
  setFormatLock(false);
  setLog('フォーマット解除 — サイズの手動設定が有効になりました','');
}


// ===== ABORT =====
async function abortGenerate(){
  if(!confirm('生成を中止しますか？\nComfyUIのキューからも削除されます。')) return;
  abortRequested = true;
  // ComfyUIのキューからジョブを削除
  if(currentPromptId){
    try{
      await fetch(`${COMFYUI_URL}/queue`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({delete:[currentPromptId]})
      });
    } catch(e){ console.warn('queue delete failed:', e); }
  }
  // WebSocketを閉じる
  if(ws){ try{ ws.close(); }catch(e){} ws=null; }
  // generateRejectで待機中のPromiseを解決
  if(generateReject){ generateReject('中止'); generateReject=null; }
  hideLock();
  stopElapsedTimer();
  resetUI();
  setLog('生成を中止しました','error');
  abortRequested = false;
  currentPromptId = null;
}

// CLIENT_IDは送信ごとに生成する（固定だとComfyUIのキュー管理と衝突する場合がある）
function newClientId(){ return 'ink-' + Date.now() + '-' + Math.random().toString(36).slice(2,6); }
let wsCompleted = false;
let generateResolve = null;
let generateReject = null;
let abortRequested = false;
let currentPromptId = null;
let currentSessionId = '';
let currentSampler = 'dpmpp_2m';
let currentScheduler = 'karras';

const SAMPLER_OPTIONS = [
  ['euler', 'Euler'],
  ['euler_ancestral', 'Euler a'],
  ['dpmpp_2m', 'DPM++ 2M'],
  ['dpmpp_2m_sde', 'DPM++ 2M SDE'],
  ['dpmpp_3m_sde', 'DPM++ 3M SDE'],
  ['dpmpp_sde', 'DPM++ SDE']
];
const SCHEDULER_OPTIONS = [
  ['normal', 'Normal'],
  ['karras', 'Karras'],
  ['exponential', 'Exponential'],
  ['sgm_uniform', 'SGM Uniform'],
  ['simple', 'Simple']
];
function optionHtml(options, selected){
  return options.map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('');
}
function setSamplerSettings(){
  const samplerEl = document.getElementById('sampler');
  const schedulerEl = document.getElementById('scheduler');
  currentSampler = samplerEl?.value || currentSampler;
  currentScheduler = schedulerEl?.value || currentScheduler;
  setLog(`Sampler設定：${currentSampler} / ${currentScheduler}`, 'success');
}


// ===== SIZE BUTTONS =====
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.size-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const isCustom = btn.classList.contains('custom-btn');
    document.getElementById('custom-size-row').style.display = isCustom ? 'grid' : 'none';
    if (!isCustom) {
      selectedSize = {w:parseInt(btn.dataset.w), h:parseInt(btn.dataset.h)};
      document.getElementById('canvas-area').style.aspectRatio = `${selectedSize.w}/${selectedSize.h}`;
    }
  });
});
document.getElementById('custom-w').addEventListener('input', updateCustomSize);
document.getElementById('custom-h').addEventListener('input', updateCustomSize);
function updateCustomSize() {
  const w = parseInt(document.getElementById('custom-w').value)||512;
  const h = parseInt(document.getElementById('custom-h').value)||512;
  selectedSize = {w,h};
  document.getElementById('canvas-area').style.aspectRatio = `${w}/${h}`;
}


// ===== LoRA =====
document.getElementById('lora-select').addEventListener('change', function() {
  document.getElementById('lora-strength-row').style.display = this.value ? 'grid' : 'none';
});
document.getElementById('lora-strength').addEventListener('input', function() {
  document.getElementById('lora-strength-display').textContent = parseFloat(this.value).toFixed(2);
});


// ===== REFERENCE =====
function onRefChange(e) {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    refImageBase64 = ev.target.result.split(',')[1];
    document.getElementById('ref-preview').src = ev.target.result;
    document.getElementById('ref-preview').style.display = 'block';
    document.getElementById('ref-placeholder').style.display = 'none';
    document.getElementById('ref-upload-area').classList.add('has-image');
    document.getElementById('ref-clear').style.display = 'block';
    document.getElementById('ref-resize-wrap').style.display = 'block';
  };
  reader.readAsDataURL(file);
}
function clearRef() {
  refImageBase64 = null;
  document.getElementById('ref-input').value = '';
  document.getElementById('ref-preview').style.display = 'none';
  document.getElementById('ref-preview').src = '';
  document.getElementById('ref-placeholder').style.display = 'block';
  document.getElementById('ref-upload-area').classList.remove('has-image');
  document.getElementById('ref-clear').style.display = 'none';
  document.getElementById('ref-resize-wrap').style.display = 'none';
}
const refArea = document.getElementById('ref-upload-area');
refArea.addEventListener('dragover',e=>{e.preventDefault();refArea.style.borderColor='var(--amber)';});
refArea.addEventListener('dragleave',()=>{if(!refImageBase64)refArea.style.borderColor='';});
refArea.addEventListener('drop',e=>{
  e.preventDefault();
  const file=e.dataTransfer.files[0];
  if(file&&file.type.startsWith('image/')){
    const input=document.getElementById('ref-input');
    const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;
    onRefChange({target:input});
  }
});


// ===== SEED =====
function randomizeSeed(){document.getElementById('seed').value=Math.floor(Math.random()*9999999999);}


// ===== TIMER =====
function startElapsedTimer(){
  startTime=Date.now();
  elapsedTimer=setInterval(()=>{
    document.getElementById('lock-elapsed-val').textContent=((Date.now()-startTime)/1000).toFixed(1)+'s';
  },100);
}
function stopElapsedTimer(){
  clearInterval(elapsedTimer);
  const sec=((Date.now()-startTime)/1000).toFixed(1);
  const min=Math.floor(sec/60);
  const display=min>0?`${min}m ${(sec%60).toFixed(1)}s`:`${sec}s`;
  document.getElementById('elapsed-val').textContent=display;
  document.getElementById('elapsed-display').style.display='block';
  return display;
}


// ===== LOCK =====
function showLock(){
  document.getElementById('lock-progress-fill').style.width='0%';
  document.getElementById('lock-progress-text').textContent='接続中...';
  document.getElementById('lock-elapsed-val').textContent='0.0s';
  document.getElementById('lock-overlay').classList.add('active');
}
function hideLock(){document.getElementById('lock-overlay').classList.remove('active');}
function updateLockProgress(pct,text){
  document.getElementById('lock-progress-fill').style.width=pct+'%';
  document.getElementById('lock-progress-text').textContent=text;
}


// ===== ACCELERATOR =====
let accelMode = 'GPU';
function setAccel(mode, btn){
  accelMode = mode;
  document.querySelectorAll('.accel-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  setLog(mode==='GPU' ? '⚡ GPU (OpenVINO) モード' : '🖥 CPU 互換モードに切り替えました', '');
}


// ===== WORKFLOW =====
function buildWorkflow(){
  const checkpoint=document.getElementById('checkpoint-select').value;
  const positive=document.getElementById('positive-prompt').value;
  const negative=document.getElementById('negative-prompt').value;
  const steps=parseInt(document.getElementById('steps').value);
  const cfg=parseFloat(document.getElementById('cfg').value);
  const seedRaw=parseInt(document.getElementById('seed').value);
  const seed=seedRaw===-1?Math.floor(Math.random()*9999999999):seedRaw;
  currentSeed = seed; // 結果カードに表示するために保存
  const loraName=document.getElementById('lora-select').value;
  const loraStr=parseFloat(document.getElementById('lora-strength').value);
  const samplerEl=document.getElementById('sampler');
  const schedulerEl=document.getElementById('scheduler');
  currentSampler=samplerEl?.value || currentSampler;
  currentScheduler=schedulerEl?.value || currentScheduler;
  currentPromptPos=positive;

  // CPU/GPUモードでワークフロー分岐
  // ノードIDは固定（ComfyUIの標準的な使い方に合わせる）
  const useGPU = accelMode === 'GPU';

  // 接続先の決定
  const clipSrc     = loraName ? ["18",1] : ["4",1];
  const modelSrc    = loraName ? ["18",0] : (useGPU ? ["17",0] : ["4",0]);
  const loraModelSrc = useGPU  ? ["17",0] : ["4",0];

  const wf = {
    "4": {inputs:{ckpt_name:checkpoint}, class_type:"CheckpointLoaderSimple"},
    "5": {inputs:{width:selectedSize?.w||512, height:selectedSize?.h||768, batch_size:1}, class_type:"EmptyLatentImage"}
  };
  if(useGPU){
    wf["17"] = {inputs:{device:"GPU", model:["4",0]}, class_type:"TorchCompileDiffusionOpenVINO"};
  }
  if(loraName){
    wf["18"] = {inputs:{lora_name:loraName, strength_model:loraStr, strength_clip:loraStr, model:loraModelSrc, clip:["4",1]}, class_type:"LoraLoader"};
  }
  wf["6"]  = {inputs:{text:positive, clip:clipSrc}, class_type:"CLIPTextEncode"};
  wf["7"]  = {inputs:{text:negative, clip:clipSrc}, class_type:"CLIPTextEncode"};
  wf["3"]  = {inputs:{seed, steps, cfg, sampler_name:currentSampler, scheduler:currentScheduler, denoise:1, model:modelSrc, positive:["6",0], negative:["7",0], latent_image:["5",0]}, class_type:"KSampler"};
  wf["8"]  = {inputs:{samples:["3",0], vae:["4",2]}, class_type:"VAEDecode"};
  // ファイル名プレフィックス: モデル名略称_LoRA名略称_タイムスタンプ
  function shortenName(name){
    // 拡張子除去
    const base = name.replace(/\.safetensors$|\.ckpt$|\.pt$/i, '');
    // 記号・スペースをアンダースコアに、連続アンダースコアを1つに
    const clean = base.replace(/[\s\-\.\/\\]+/g, '_').replace(/_+/g, '_');
    // 先頭16文字
    return clean.slice(0, 16);
  }
  const modelShort = shortenName(checkpoint || 'nomodel');
  const loraShort  = loraName ? '_' + shortenName(loraName) : '';
  const ts = new Date().toISOString().slice(0,16).replace('T','_').replace(':','-').replace(':','');
  const filenamePrefix = `IA_${modelShort}${loraShort}_s${seed}_${ts}`;
  wf["9"]  = {inputs:{filename_prefix:filenamePrefix, images:["8",0]}, class_type:"SaveImage"};
  return wf;
}


// ===== GENERATE =====
async function generate(){
  showLock(); startElapsedTimer();
  // グリッドをクリア・プレースホルダーを隠す
  document.getElementById('result-grid').innerHTML='';
  document.getElementById('placeholder').style.display='none';
  document.getElementById('result-actions').style.display='none';
  document.getElementById('generating-progress').style.display='block';
  document.getElementById('progress-fill').style.width='0%';
  document.getElementById('spinner').style.display='block';
  setLog(`ワークフローを送信しています... (${generateCount}枚)`,'');

  abortRequested=false;
  for(let gi=1; gi<=generateCount; gi++){
    if(abortRequested) break;
    updateLockProgress(Math.round((gi-1)/generateCount*100), `ステップ待機中...`);
    // 枚数カウンターを更新
    if(generateCount > 1){
      document.getElementById('lock-counter').style.display='block';
      document.getElementById('lock-counter-text').textContent=`${gi} / ${generateCount}`;
    } else {
      document.getElementById('lock-counter').style.display='none';
    }
    try {
      const wf=buildWorkflow();
      currentSessionId = newClientId();
      const payload={prompt:wf,client_id:currentSessionId};
      console.log('[InkAtelier] Sending payload:', JSON.stringify(payload, null, 2));
      const res=await fetch(`${COMFYUI_URL}/prompt`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!res.ok){
        let errBody='';
        try{ errBody=await res.text(); }catch(_){}
        throw new Error(`サーバーエラー: ${res.status} / ${errBody.slice(0,500)}`);
      }
      let data;
      try { data=await res.json(); } catch(je){ throw new Error('レスポンスのパースに失敗しました'); }
      if(!data || !data.prompt_id) throw new Error('prompt_idが取得できませんでした: '+JSON.stringify(data));
      const currentPid=data.prompt_id;
      promptId=currentPid;
      currentPromptId=currentPid;
      updateLockProgress(5,`送信完了 [${currentPid.slice(0,8)}...]`);
      setLog(`生成開始 [${currentPid.slice(0,8)}...]`,'');

      // 完了をPromiseで待つ（fetchResultが呼ばれたら解決）
      await new Promise((resolve, reject)=>{
        const timeout=setTimeout(()=>reject(new Error('タイムアウト（30分）')), 5400000);
        generateResolve=()=>{ clearTimeout(timeout); resolve(); };
        generateReject=(msg)=>{ clearTimeout(timeout); reject(new Error(msg)); };
        wsCompleted=false;
        listenProgress(currentPid);
        pollResult(currentPid, 0, true);
      });

      // 次の枚数送信前に少し待つ
      if(gi < generateCount){ await new Promise(r=>setTimeout(r,2000)); }
    } catch(e){
      setLog('送信に失敗しました: '+e.message,'error');
      hideLock(); stopElapsedTimer(); resetUI();
      return;
    }
  }
  // 全枚完了後の後処理
  document.getElementById('generating-progress').style.display='none';
}

function listenProgress(pid){
  wsCompleted = false;
  if(ws) ws.close();
  ws=new WebSocket(`${COMFYUI_URL.replace(/^http/,"ws")}/ws?clientId=${currentSessionId}`);
  ws.onmessage=async(event)=>{
    try {
      const msg=JSON.parse(event.data);
      if(msg.type==='progress'){
        const pct=Math.round((msg.data.value/msg.data.max)*100);
        document.getElementById('progress-fill').style.width=pct+'%';
        document.getElementById('progress-text').textContent=`生成中... ${pct}%`;
        updateLockProgress(pct,`ステップ ${msg.data.value} / ${msg.data.max}  (${pct}%)`);
        setLog(`ステップ ${msg.data.value} / ${msg.data.max}`,'');
      }
      if(msg.type==='executing'&&msg.data.node===null&&msg.data.prompt_id===pid){
        if(!wsCompleted){ wsCompleted=true; ws.close(); await fetchResult(pid); }
      }
    } catch(e){}
  };
  ws.onerror=()=>{ setLog('WebSocket接続エラー','error'); };
}

async function pollResult(pid, attempts=0, passive=false){
  // passiveモード: WebSocketが先に完了したら何もしない
  if(passive && wsCompleted) return;
  if(attempts > 1800){ if(!wsCompleted){ setLog('タイムアウト（30分経過）。モデルが重い可能性があります','error'); hideLock(); stopElapsedTimer(); resetUI(); if(generateReject){ generateReject('タイムアウト'); generateReject=null; } } return; }
  try {
    const res=await fetch(`${COMFYUI_URL}/history/${pid}`);
    const data=await res.json();
    if(data[pid]?.outputs && Object.keys(data[pid].outputs).length>0){
      if(!wsCompleted){ wsCompleted=true; await fetchResult(pid); }
    } else {
      setTimeout(()=>pollResult(pid,attempts+1,passive),5000);
    }
  } catch { setTimeout(()=>pollResult(pid,attempts+1,passive),5000); }
}


// ===== FETCH RESULT =====
async function fetchResult(pid){
  try {
    const res=await fetch(`${COMFYUI_URL}/history/${pid}`);
    const data=await res.json();
    const outputs=data[pid]?.outputs||{};
    let imgInfo=null;
    for(const nid in outputs){
      if(outputs[nid].images?.length>0){ imgInfo=outputs[nid].images[0]; break; }
    }
    if(!imgInfo) throw new Error('画像が見つかりません');

    imgInfo.type = imgInfo.type || 'output';
    // /history全体への反映が遅れる環境でもGalleryに即反映されるよう、直近生成をローカルに記録
    if(typeof rememberGalleryItem === 'function'){
      rememberGalleryItem({ ...imgInfo, prompt: currentPromptPos || '', pid, createdAt: Date.now() });
    }
    const imgUrl=`${COMFYUI_URL}/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${encodeURIComponent(imgInfo.subfolder||'')}&type=${imgInfo.type}`;
    const blob=await(await fetch(imgUrl)).blob();
    currentImageData=URL.createObjectURL(blob);

    // グリッドにカードを追加
    const grid = document.getElementById('result-grid');
    const cardIndex = grid.children.length + 1;
    const card = document.createElement('div');
    card.className = 'result-card';
    // 枚数によって画像サイズを調整
    const imgMaxW = generateCount === 1 ? '480px' : generateCount === 2 ? '380px' : '280px';
    const cid = 'card' + cardIndex;
    card.innerHTML = `
      <img src="${currentImageData}" style="max-width:${imgMaxW};cursor:pointer;" alt="生成画像 ${cardIndex}"
           onclick="openResultModal('${currentImageData}')">
      <div class="result-card-label">${cardIndex} / ${generateCount}</div>
      <div class="result-card-seed" onclick="copyAndSetSeed(${currentSeed})" title="クリックでSeed欄にコピー">
        🎲 Seed: ${currentSeed}
      </div>
      <div class="result-card-resize-row">
        <input type="number" id="${cid}-w" placeholder="W (px)">
        <input type="number" id="${cid}-h" placeholder="H (px)">
      </div>
      <div class="result-card-actions">
        <button onclick="saveCardImage('${currentImageData}', ${cardIndex})">💾 保存</button>
        <button onclick="saveCardResized('${currentImageData}', ${cardIndex}, '${cid}')">📐 リサイズ</button>
        <button onclick="removeBg('${currentImageData}', ${cardIndex})">✂ 背景透過</button>
      </div>`;
    grid.appendChild(card);
    // アクションバー（リサイズW/H）は最終枚のみ表示
    if(cardIndex === generateCount){
      // 最終枚完了時のみロック解除
      document.getElementById('generating-progress').style.display='none';
      document.getElementById('result-actions').style.display='flex';
      const elapsed=stopElapsedTimer();
      hideLock();
      setLog(`全${generateCount}枚 生成完了 (${elapsed})`,'success');
    } else {
      setLog(`${cardIndex}/${generateCount}枚目 完了。次を生成中...`,'');
    }
    await loadGallery(false);
    setTimeout(() => loadGallery(false), 1500);
    if(generateResolve){ generateResolve(); generateResolve=null; }
  } catch(e){
    setLog('画像の取得に失敗しました: '+e.message,'error');
    hideLock(); stopElapsedTimer();
    if(generateReject){ generateReject('画像取得失敗: '+e.message); generateReject=null; }
  }
  resetUI();
}


// ===== SAVE / RESIZE =====

// ===== RESULT CARD ACTIONS =====
function saveCardImage(src, idx){
  const a=document.createElement('a');
  a.href=src;
  a.download=`InkAtelier_result_${idx}_${Date.now()}.png`;
  a.click();
}
async function saveCardResized(src, idx, cid){
  const w=parseInt(document.getElementById(cid+'-w')?.value)||null;
  const h=parseInt(document.getElementById(cid+'-h')?.value)||null;
  if(!w&&!h){ setLog('W または H を入力してください','error'); return; }
  await resizeAndDownload(src,w,h,`InkAtelier_resized_${idx}_${Date.now()}.png`);
}


// ===== 背景透過 =====
async function removeBg(src, idx){
  setLog('背景透過処理中...','');
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0);
      const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);
      const data=imageData.data;
      // 四隅の色をサンプリングして背景色を推定
      const corners=[
        [data[0],data[1],data[2]],
        [data[(canvas.width-1)*4],data[(canvas.width-1)*4+1],data[(canvas.width-1)*4+2]],
        [data[(canvas.height-1)*canvas.width*4],data[(canvas.height-1)*canvas.width*4+1],data[(canvas.height-1)*canvas.width*4+2]],
        [data[((canvas.height-1)*canvas.width+(canvas.width-1))*4],data[((canvas.height-1)*canvas.width+(canvas.width-1))*4+1],data[((canvas.height-1)*canvas.width+(canvas.width-1))*4+2]]
      ];
      const bgR=Math.round(corners.reduce((s,c)=>s+c[0],0)/4);
      const bgG=Math.round(corners.reduce((s,c)=>s+c[1],0)/4);
      const bgB=Math.round(corners.reduce((s,c)=>s+c[2],0)/4);
      const threshold=30;
      for(let i=0;i<data.length;i+=4){
        const dr=Math.abs(data[i]-bgR);
        const dg=Math.abs(data[i+1]-bgG);
        const db=Math.abs(data[i+2]-bgB);
        if(dr<threshold&&dg<threshold&&db<threshold) data[i+3]=0;
      }
      ctx.putImageData(imageData,0,0);
      const a=document.createElement('a');
      a.href=canvas.toDataURL('image/png');
      a.download=`InkAtelier_nobg_${idx}_${Date.now()}.png`;
      a.click();
      setLog(`背景透過完了 (${idx}枚目)`,'success');
      resolve();
    };
    img.src=src;
  });
}
function openResultModal(src){
  // ギャラリーモーダルを流用して拡大表示
  const modal=document.getElementById('gallery-modal');
  if(!modal) return;
  document.getElementById('modal-img').src=src;
  modal.classList.add('active');
  modalCurrentFile=null; // 保存ボタン等は非表示にする
  document.getElementById('modal-actions').style.display='none';
}

function saveResult(){
  if(!currentImageData) return;
  const a=document.createElement('a'); a.href=currentImageData; a.download=`InkAtelier_${Date.now()}.png`; a.click();
}
async function saveResultResized(){
  const w=parseInt(document.getElementById('result-resize-w').value)||null;
  const h=parseInt(document.getElementById('result-resize-h').value)||null;
  if(!w&&!h){ saveResult(); return; }
  await resizeAndDownload(currentImageData,w,h,`InkAtelier_resized_${Date.now()}.png`);
}
async function resizeAndDownload(src,w,h,filename){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      const origW=img.naturalWidth, origH=img.naturalHeight;
      let newW=w||Math.round(origW*(h/origH));
      let newH=h||Math.round(origH*(w/origW));
      const canvas=document.createElement('canvas');
      canvas.width=newW; canvas.height=newH;
      canvas.getContext('2d').drawImage(img,0,0,newW,newH);
      const a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download=filename; a.click();
      setLog(`リサイズ完了 (${newW}×${newH})`,'success');
      resolve();
    };
    img.src=src;
  });
}


// ===== GENERATE COUNT =====
function setCount(n, btn){
  generateCount = n;
  document.querySelectorAll('[id^="count-btn-"]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

// Seedをコピーしてインプットに反映
function copyAndSetSeed(seed){
  document.getElementById('seed').value = seed;
  navigator.clipboard.writeText(String(seed)).catch(()=>{});
  setLog(`Seed ${seed} をセットしました`,'success');
}
