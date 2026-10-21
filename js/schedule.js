// ===== SCHEDULE =====
let schedules = JSON.parse(localStorage.getItem('ink_schedules')||'[]');
let currentScheduleId = null;

function renderScheduleList(){
  const list = document.getElementById('schedule-list');
  if(!schedules.length){
    list.innerHTML='<div style="padding:16px;font-family:\'JetBrains Mono\',monospace;font-size:.68rem;color:var(--ink-600);">予約がありません</div>';
    return;
  }
  list.innerHTML = schedules.map(s=>`
    <div class="schedule-item ${s.id===currentScheduleId?'active':''}" onclick="selectSchedule('${s.id}')">
      <div class="schedule-item-time">${s.startTime||'--:--'}</div>
      <div class="schedule-item-info">
        <span class="schedule-item-badge">${s.count||1}枚</span>
        <span class="schedule-item-badge">${s.interval||10}分間隔</span>
        ${escapeHtml((s.positive||'').slice(0,30))}${(s.positive||'').length>30?'...':''}
      </div>
    </div>
  `).join('');
}

function newSchedule(){
  const s={
    id:Date.now().toString(),
    startTime:'03:00',
    count:10,
    interval:10,
    positive:document.getElementById('positive-prompt').value,
    negative:document.getElementById('negative-prompt').value,
    checkpoint:document.getElementById('checkpoint-select').value,
    lora:'',
    width:selectedSize.w,
    height:selectedSize.h,
    steps:parseInt(document.getElementById('steps').value)||40,
    cfg:parseFloat(document.getElementById('cfg').value)||7,
    sampler:document.getElementById('sampler')?.value || currentSampler,
    scheduler:document.getElementById('scheduler')?.value || currentScheduler
  };
  schedules.push(s);
  saveSchedules();
  selectSchedule(s.id);
}

function selectSchedule(id){
  currentScheduleId=id;
  const s=schedules.find(x=>x.id===id);
  if(!s) return;
  renderScheduleList();
  document.getElementById('schedule-editor').innerHTML=`
    <div>
      <div class="schedule-section-label">Start Time</div>
      <input type="time" id="sch-time" value="${s.startTime}" oninput="updateSchedule('startTime',this.value)" style="width:160px;margin-bottom:0;">
    </div>

    <div>
      <div class="schedule-section-label">Generation</div>
      <div class="schedule-grid-2">
        <div><label>枚数</label><input type="number" id="sch-count" value="${s.count}" min="1" max="50" oninput="updateSchedule('count',parseInt(this.value))"></div>
        <div><label>間隔（分）</label><input type="number" id="sch-interval" value="${s.interval}" min="1" max="120" oninput="updateSchedule('interval',parseInt(this.value))"></div>
      </div>
    </div>

    <div>
      <div class="schedule-section-label">Size</div>
      <div class="schedule-grid-2">
        <div><label>W (px)</label><input type="number" id="sch-w" value="${s.width}" min="64" max="2048" oninput="updateSchedule('width',parseInt(this.value))"></div>
        <div><label>H (px)</label><input type="number" id="sch-h" value="${s.height}" min="64" max="2048" oninput="updateSchedule('height',parseInt(this.value))"></div>
      </div>
    </div>

    <div>
      <div class="schedule-section-label">Model</div>
      <select class="note-select" id="sch-checkpoint" onchange="updateSchedule('checkpoint',this.value)">
        <option value="">（未設定）</option>
        ${checkpointList.map(c=>`<option value="${c}" ${c===s.checkpoint?'selected':''}>${c}</option>`).join('')}
      </select>
      <div style="margin-top:6px;">
      <select class="note-select" id="sch-lora" onchange="updateSchedule('lora',this.value)">
        <option value="">LoRA なし</option>
        ${loraList.map(l=>`<option value="${l}" ${l===s.lora?'selected':''}>${l}</option>`).join('')}
      </select>
      </div>
    </div>

    <div>
      <div class="schedule-section-label">Prompt</div>
      <div class="schedule-section-label" style="color:var(--ink-400);margin-top:2px;margin-bottom:4px;">Positive</div>
      <textarea class="note-textarea" rows="4" oninput="updateSchedule('positive',this.value)">${escapeHtml(s.positive)}</textarea>
      <div class="schedule-section-label" style="color:var(--ink-400);margin-top:8px;margin-bottom:4px;">Negative</div>
      <textarea class="note-textarea" rows="2" oninput="updateSchedule('negative',this.value)">${escapeHtml(s.negative)}</textarea>
    </div>

    <div>
      <div class="schedule-section-label">Advanced</div>
      <div class="schedule-grid-2">
        <div><label>Steps</label><input type="number" id="sch-steps" value="${s.steps}" min="1" max="150" oninput="updateSchedule('steps',parseInt(this.value))"></div>
        <div><label>CFG Scale</label><input type="number" id="sch-cfg" value="${s.cfg}" min="1" max="30" step="0.5" oninput="updateSchedule('cfg',parseFloat(this.value))"></div>
      </div>
      <div class="schedule-grid-2" style="margin-top:8px;">
        <div><label>Sampler</label><select class="note-select" id="sch-sampler" onchange="updateSchedule('sampler',this.value)">${optionHtml(SAMPLER_OPTIONS, s.sampler || 'dpmpp_2m')}</select></div>
        <div><label>Scheduler</label><select class="note-select" id="sch-scheduler" onchange="updateSchedule('scheduler',this.value)">${optionHtml(SCHEDULER_OPTIONS, s.scheduler || 'karras')}</select></div>
      </div>
    </div>

    <div class="schedule-actions">
      <button class="btn-from-note" onclick="importFromGenerate()">↓ Generateから取り込む</button>
      <button class="btn-del-note" onclick="deleteSchedule()">削除</button>
    </div>

    <div style="background:var(--ink-800);border:1px solid var(--ink-700);border-radius:4px;padding:10px 12px;">
      <div class="schedule-section-label" style="margin-bottom:6px;">予定タイムライン</div>
      <div id="sch-timeline" style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:var(--ink-400);line-height:2;"></div>
    </div>
  `;
  renderTimeline(s);
}

function renderTimeline(s){
  const el=document.getElementById('sch-timeline');
  if(!el) return;
  const [h,m]=s.startTime.split(':').map(Number);
  let lines=[];
  for(let i=0;i<Math.min(s.count,10);i++){
    const total=h*60+m+i*s.interval;
    const th=Math.floor(total/60)%24;
    const tm=total%60;
    lines.push(`${String(th).padStart(2,'0')}:${String(tm).padStart(2,'0')}  →  ${i+1}枚目`);
  }
  if(s.count>10) lines.push(`... 合計 ${s.count} 枚`);
  const lastTotal=h*60+m+(s.count-1)*s.interval;
  const lh=Math.floor(lastTotal/60)%24;
  const lm=lastTotal%60;
  lines.push(`完了予定：${String(lh).padStart(2,'0')}:${String(lm).padStart(2,'0')}`);
  el.innerHTML=lines.map(l=>`<div>${l}</div>`).join('');
}

function updateSchedule(field,val){
  const s=schedules.find(x=>x.id===currentScheduleId);
  if(s){
    s[field]=val;
    saveSchedules();
    renderScheduleList();
    renderTimeline(s);
  }
}

function importFromGenerate(){
  const s=schedules.find(x=>x.id===currentScheduleId);
  if(!s) return;
  s.positive=document.getElementById('positive-prompt').value;
  s.negative=document.getElementById('negative-prompt').value;
  s.checkpoint=document.getElementById('checkpoint-select').value;
  s.lora=document.getElementById('lora-select').value;
  s.width=selectedSize.w;
  s.height=selectedSize.h;
  s.steps=parseInt(document.getElementById('steps').value);
  s.cfg=parseFloat(document.getElementById('cfg').value);
  s.sampler=document.getElementById('sampler')?.value || currentSampler;
  s.scheduler=document.getElementById('scheduler')?.value || currentScheduler;
  saveSchedules();
  selectSchedule(s.id);
  setLog('Generateの設定を取り込みました','success');
}

function deleteSchedule(){
  schedules=schedules.filter(x=>x.id!==currentScheduleId);
  currentScheduleId=null;
  saveSchedules(); renderScheduleList();
  document.getElementById('schedule-editor').innerHTML='<div style="flex:1;display:flex;align-items:center;justify-content:center;"><span style="color:var(--ink-600);font-family:\'JetBrains Mono\',monospace;font-size:.72rem;">予約を選択または新規追加</span></div>';
}

function saveSchedules(){ localStorage.setItem('ink_schedules',JSON.stringify(schedules)); }

function exportScheduleJSON(){
  if(!schedules.length){ setLog('予約がありません','error'); return; }
  const json=JSON.stringify(schedules,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='schedule.json'; a.click();
  setLog('schedule.json を出力しました。お使いのスケジューラに渡してください','success');
}
