async function checkConnection() {
  setSplash(10, '接続確認中...');
  try {
    const res = await fetch(`${COMFYUI_URL}/system_stats`);
    if (res.ok) {
      setSplash(30, 'ComfyUI 接続済み');
      setStatus('online','ComfyUI 接続済み');
      setSplash(50, 'モデルを読み込み中...');
      await loadModels();
      setSplash(80, 'ギャラリーを読み込み中...');
      await loadGallery(false);
      setSplash(100, '完了');
      setTimeout(hideSplash, 400);
      setLog('ComfyUIに接続しました','success');
    } else throw new Error();
  } catch {
    setStatus('error','オフライン');
    setSplash(100, 'ComfyUIに接続できません');
    setTimeout(hideSplash, 1500);
    setLog('ComfyUIに接続できません。接続先URL（js/config.js）とComfyUIの起動を確認してください。','error');
  }
}

async function loadModels() {
  try {
    const res = await fetch(`${COMFYUI_URL}/object_info/CheckpointLoaderSimple`);
    const data = await res.json();
    checkpointList = data.CheckpointLoaderSimple.input.required.ckpt_name[0];
    const sel = document.getElementById('checkpoint-select');
    sel.innerHTML = checkpointList.map(c=>`<option value="${c}" ${c.includes('JANKUTrained')?'selected':''}>${c}</option>`).join('');
    document.getElementById('model-count').textContent = checkpointList.length;
    setLog(`モデルを ${checkpointList.length} 件読み込みました`,'success');
  } catch { setLog('モデル一覧の取得に失敗しました','error'); }
  try {
    const res = await fetch(`${COMFYUI_URL}/object_info/LoraLoader`);
    const data = await res.json();
    loraList = data.LoraLoader.input.required.lora_name[0];
    const sel = document.getElementById('lora-select');
    sel.innerHTML = '<option value="">なし</option>'+loraList.map(l=>`<option value="${l}">${l}</option>`).join('');
    document.getElementById('lora-count').textContent = loraList.length;
    // ノートエディタのセレクトも更新
    syncNoteSelects();
  } catch { document.getElementById('lora-count').textContent = '0'; }
}
