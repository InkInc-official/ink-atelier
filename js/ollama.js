// ===== OLLAMA =====
let ollamaModel = localStorage.getItem('ollama_model') || 'qwen2.5:7b';

function saveOllamaSettings(){
  const sel = document.getElementById('ollama-model-select');
  if(sel && sel.value) {
    ollamaModel = sel.value;
    localStorage.setItem('ollama_model', ollamaModel);
  }
}

function setOllamaStatus(online, count){
  document.querySelectorAll('.ollama-status').forEach(el=>{
    el.classList.toggle('online', online);
    el.classList.toggle('offline', !online);
    el.title = online ? `Ollama 接続済み (${ollamaModel})` : 'Ollama オフライン';
  });
  const llmCount = document.getElementById('llm-count');
  if(llmCount) llmCount.textContent = online ? (count||'?') : '—';
}

async function checkOllamaStatus(){
  try{
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {signal: AbortSignal.timeout(3000)});
    if(!res.ok){ setOllamaStatus(false); return; }
    const data = await res.json();
    const models = data.models || [];
    // モデルセレクトを更新
    const sel = document.getElementById('ollama-model-select');
    if(sel){
      const prev = localStorage.getItem('ollama_model') || 'qwen2.5:7b';
      sel.innerHTML = models.map(m=>
        `<option value="${m.name}" ${m.name===prev?'selected':''}>${m.name}</option>`
      ).join('') || '<option value="">モデルなし</option>';
      // 選択中モデルを更新
      if(sel.value) ollamaModel = sel.value;
    }
    setOllamaStatus(true, models.length);
  } catch(e){
    setOllamaStatus(false);
  }
}

async function translatePrompt(targetId){
  const el = document.getElementById(targetId);
  if(!el) return;
  const text = el.value.trim();
  if(!text){ setLog('翻訳するテキストがありません','error'); return; }

  // 日本語が含まれていなければスキップ
  const hasJapanese = /[\u3040-\u30FF\u3400-\u9FFF\uFF00-\uFFEF]/.test(text);
  if(!hasJapanese){ setLog('日本語が含まれていません。英語のまま使用できます',''); return; }

  // ボタンをローディング状態に
  const btn = el.parentElement?.querySelector('.btn-translate') ||
              el.closest('.field-row')?.querySelector('.btn-translate');
  if(btn){ btn.classList.add('translating'); btn.textContent='変換中...'; }

  setLog('Ollamaで翻訳中...','');

  const systemPrompt = `You are an expert at converting Japanese text into Stable Diffusion prompt tags.
Rules:
- Convert Japanese descriptions into English Stable Diffusion prompt tags
- Output ONLY comma-separated English tags, nothing else
- No explanations, no sentences, no markdown
- Use standard SD prompt format: "short descriptive tags, separated by commas"
- Example input: 黒い着物を着た美少女、青い目、笑顔
- Example output: black kimono, beautiful girl, blue eyes, smile`;

  const userPrompt = `Convert this to English SD prompt tags:
${text}`;

  try{
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        model: ollamaModel,
        prompt: userPrompt,
        system: systemPrompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 200 }
      })
    });
    if(!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json();
    const translated = data.response?.trim();
    if(!translated) throw new Error('空のレスポンス');

    // 結果を反映（元テキストをコメントとして残す）
    el.value = translated;
    el.dispatchEvent(new Event('input')); // oninputを発火（キャラ定義の保存トリガー）
    setLog(`翻訳完了 → ${translated.slice(0,60)}...`,'success');
  } catch(e){
    setLog('翻訳失敗: '+e.message,'error');
    setOllamaStatus(false);
  } finally{
    if(btn){ btn.classList.remove('translating'); btn.textContent='🇯🇵 → EN'; }
  }
}
