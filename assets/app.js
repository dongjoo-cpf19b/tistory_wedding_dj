/* Wedding concept board. No external scripts, analytics or automatic photo uploads. */
(() => {
  'use strict';
  const C=window.WeddingCore,$=id=>document.getElementById(id);
  let state=C.project(),active=state.scenes[0].id,dirty=false,pendingRequest=null,agentConnected=false,toastTimer;
  const current=()=>state.scenes.find(s=>s.id===active)||state.scenes[0];
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const filename=s=>(s||'wedding').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,70);
  function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),5000);}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  const blobOf=data=>{const [head,body]=data.split(',');const bytes=Uint8Array.from(atob(body),c=>c.charCodeAt(0));return new Blob([bytes],{type:head.split(':')[1].split(';')[0]});};
  const loadImage=data=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('사진을 읽을 수 없습니다.'));img.src=data;});
  async function readImage(file){
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('JPG, PNG, WebP 사진을 선택해 주세요.');
    if(file.size>20*1024*1024)throw Error('사진은 한 장당 20MB 이하로 선택해 주세요.');
    const url=URL.createObjectURL(file);
    try{const img=await loadImage(url);if(img.width*img.height>50000000)throw Error('사진 크기가 너무 큽니다. 5천만 화소 이하로 줄여 주세요.');
      const scale=Math.min(1,1600/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
      return {name:file.name,data:canvas.toDataURL('image/jpeg',.9)};
    }finally{URL.revokeObjectURL(url);}
  }
  function assetMarkup(key,image){return `<div class="asset ${key}"><div class="asset-label"><span>${C.roles[key]}</span>${image?`<button data-clear="${key}" aria-label="${C.roles[key]} 삭제">삭제</button>`:''}</div><label class="asset-input"><input data-photo="${key}" aria-label="${C.roles[key]} 추가" type="file" accept="image/jpeg,image/png,image/webp">${image?`<img src="${image.data}" alt="${C.roles[key]} 참고사진">`:'<span class="asset-empty"><b>+</b><span>사진 추가</span></span>'}</label></div>`;}
  function refreshAssets(){
    const s=current(),mode=C.sceneMode(state);
    $('people').innerHTML=['bride','groom'].map(k=>assetMarkup(k,state.people[k])).join('');
    $('references').innerHTML=['dress','hairRef'].map(k=>assetMarkup(k,s[k])).join('');
    document.querySelectorAll('[name="studioPlan"],[name="hasStudioPhotos"]').forEach(el=>{el.checked=state[el.name]===el.value;});
    $('studio-photo-question').hidden=state.studioPlan!=='yes';
    $('studio-route').textContent=mode==='virtual'?'아래 예시에서 마음에 드는 가상 씬을 골라 주세요.':mode==='upload'?'아래에 예정된 스튜디오의 씬 사진을 추가해 주세요. 여러 장은 씬을 추가해 나누어 준비할 수 있습니다.':state.studioPlan==='yes'?'예정된 스튜디오의 씬 사진이 있는지 선택해 주세요.':'스튜디오가 정해졌는지 먼저 선택해 주세요.';
    $('scene-source').innerHTML=mode==='upload'?assetMarkup('studio',s.studio):mode==='virtual'?`<div class="virtual-heading"><h3>어떤 배경이 좋으세요?</h3><span>AI 가상 씬</span></div><div class="virtual-grid">${(window.WeddingScenes||[]).map(v=>`<button class="virtual-card" data-preset="${v.id}" aria-pressed="${s.virtualSceneId===v.id}"><img src="${v.data}" alt="${esc(v.name)} 가상 씬"><b>${esc(v.name)}</b><small>${esc(v.description)}</small></button>`).join('')}</div><p class="hint">실제 스튜디오가 아닌 AI 예시입니다. 씬마다 다른 배경을 선택할 수 있습니다.</p>`:'<p class="scene-pending">위 질문에 답하면 스튜디오 사진 또는 가상 씬을 선택할 수 있어요.</p>';
  }
  function refreshList(){$('scene-count').textContent=state.scenes.length;$('scene-list').innerHTML=state.scenes.map((s,i)=>`<button class="scene-item ${s.id===active?'active':''}" data-scene="${s.id}" aria-current="${s.id===active?'true':'false'}"><span class="num">${String(i+1).padStart(2,'0')}</span><span>${esc(s.title)}</span></button>`).join('');$('add-scene').disabled=state.scenes.length>=12;$('remove-scene').disabled=state.scenes.length===1;}
  function refreshResult(){const s=current(),box=$('result-preview');box.style.aspectRatio=s.size.replace('x',' / ');box.classList.toggle('has-image',!!s.result);box.innerHTML=s.result?`<img src="${s.result.data}" alt="${esc(s.title)} 생성 결과">`:'<div class="empty-art">W.</div><p>상상한 장면을<br>이곳에 담아 보세요.</p><small>AI에서 만든 이미지를 추가하면<br>촬영 시안에 함께 저장됩니다.</small>';$('download-result').disabled=!s.result;$('clear-result').disabled=!s.result;$('result-meta').innerHTML=[['분위기',s.mood],['포즈·구도',s.pose],['의상 / 헤어',[s.outfit,s.hair].filter(Boolean).join(' / ')],['촬영 메모',s.memo]].filter(([,v])=>v).map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');}
  function refreshPrompt(){$('prompt').value=C.prompt(state,current());}
  function render(){const s=current();$('project-name').value=state.name;$('scene-title').value=s.title;for(const k of ['mood','size','pose','outfit','hair','memo'])$(k).value=s[k];$('scene-number').textContent=`03 · SCENE ${String(state.scenes.indexOf(s)+1).padStart(2,'0')}`;refreshAssets();refreshList();refreshPrompt();refreshResult();}
  $('project-name').addEventListener('input',e=>{state.name=e.target.value;dirty=true;});
  for(const [id,key] of [['scene-title','title'],...['mood','size','pose','outfit','hair','memo'].map(k=>[k,k])])$(id).addEventListener('input',e=>{current()[key]=e.target.value;dirty=true;refreshList();refreshPrompt();refreshResult();});
  document.addEventListener('change',async e=>{
    if(['studioPlan','hasStudioPhotos'].includes(e.target.name)){state[e.target.name]=e.target.value;dirty=true;refreshAssets();refreshPrompt();return;}
    const key=e.target.dataset.photo;if(!key||!e.target.files[0])return;
    const destination=['bride','groom'].includes(key)?state.people:current();
    try{destination[key]=await readImage(e.target.files[0]);dirty=true;refreshAssets();refreshPrompt();}catch(error){toast(error.message);}
  });
  document.addEventListener('click',async e=>{
    const preset=e.target.closest('[data-preset]');if(preset){const v=(window.WeddingScenes||[]).find(v=>v.id===preset.dataset.preset),s=current();if(!v)return;try{const file=new File([blobOf(v.data)],v.name+'.png',{type:'image/png'});const photo=await readImage(file);s.virtualScene=photo;s.virtualSceneId=v.id;dirty=true;refreshAssets();refreshPrompt();toast(v.name+' 씬을 선택했습니다.');}catch(error){toast(error.message);}return;}const clear=e.target.closest('[data-clear]'),item=e.target.closest('[data-scene]');if(clear){const key=clear.dataset.clear;(['bride','groom'].includes(key)?state.people:current())[key]=null;dirty=true;refreshAssets();refreshPrompt();}if(item){active=item.dataset.scene;render();}});
  $('add-scene').onclick=()=>{if(state.scenes.length>=12)return;const s=C.scene();s.title=`촬영 씬 ${state.scenes.length+1}`;state.scenes.push(s);active=s.id;dirty=true;render();};
  $('remove-scene').onclick=()=>{if(state.scenes.length<2||!confirm('선택한 씬을 삭제할까요? 저장하지 않은 사진과 메모도 함께 지워집니다.'))return;state.scenes=state.scenes.filter(s=>s.id!==active);active=state.scenes[0].id;dirty=true;render();};
  $('result-file').onchange=async e=>{const s=current();try{s.result=await readImage(e.target.files[0]);dirty=true;refreshResult();toast('결과 이미지를 추가했습니다.');}catch(error){toast(error.message);}finally{e.target.value='';}};
  $('clear-result').onclick=()=>{current().result=null;dirty=true;refreshResult();};
  $('download-result').onclick=()=>{const s=current();if(s.result)download(blobOf(s.result.data),filename(s.title)+(s.result.data.startsWith('data:image/png')?'.png':'.jpg'));};
  $('save-project').onclick=()=>{const file=new Blob([JSON.stringify(state)],{type:'application/json'});if(file.size>160*1024*1024){toast('프로젝트가 160MB를 넘었습니다. 씬이나 결과 이미지를 줄여 주세요.');return;}download(file,filename(state.name)+'.wedding.json');dirty=false;toast('사진과 메모를 포함한 프로젝트 파일을 저장했습니다. 개인 파일로 보관하세요.');};
  $('load-project').onclick=()=>{if(!dirty||confirm('현재 작업을 불러온 파일로 바꿀까요? 필요한 경우 먼저 프로젝트를 저장하세요.'))$('project-file').click();};
  $('project-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>160*1024*1024)throw Error('프로젝트 파일은 160MB 이하만 불러올 수 있습니다.');const next=C.normalize(JSON.parse(await file.text()));state=next;pendingRequest=null;$('cancel-ai').hidden=true;$('agent-status').textContent='프로젝트를 불러왔습니다. 시안을 다시 준비해 주세요.';active=state.scenes[0].id;dirty=false;render();toast('프로젝트를 불러왔습니다.');}catch(error){toast(error instanceof SyntaxError?'프로젝트 파일 형식이 올바르지 않습니다.':error.message);}finally{e.target.value='';}};
  $('copy-prompt').onclick=async()=>{if(!C.studio(state,current())){toast('스튜디오 사진 또는 가상 씬을 먼저 선택해 주세요.');return;}refreshPrompt();try{await navigator.clipboard.writeText($('prompt').value);toast('요청문을 복사했습니다. 참고사진과 함께 AI에 전달하세요.');}catch{$('prompt').focus();$('prompt').select();toast('요청문이 선택되었습니다. 복사해서 AI에 전달하세요.');}};
  $('save-reference').onclick=async()=>{
    const s=current(),refs=C.refs(state,s);if(!C.studio(state,s)){toast('스튜디오 사진 또는 가상 씬을 먼저 선택해 주세요.');return;}
    try{const canvas=document.createElement('canvas'),cell=650,header=100;canvas.width=1300;canvas.height=header+Math.ceil(refs.length/2)*cell;const ctx=canvas.getContext('2d');ctx.fillStyle='#f7f5f1';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#344733';ctx.font='bold 28px sans-serif';ctx.fillText('웨딩 촬영 참고사진 · 번호별 역할을 구분해 주세요',30,58);
      for(let i=0;i<refs.length;i++){const r=refs[i],img=await loadImage(r.image.data),x=(i%2)*cell,y=header+Math.floor(i/2)*cell;ctx.fillStyle='#fff';ctx.fillRect(x+12,y+10,cell-24,cell-22);ctx.fillStyle='#344733';ctx.font='bold 24px sans-serif';ctx.fillText(`${i+1}. ${r.label}`,x+30,y+48);const scale=Math.min((cell-60)/img.width,(cell-100)/img.height),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,x+(cell-w)/2,y+75+(cell-100-h)/2,w,h);}
      canvas.toBlob(blob=>{if(blob){download(blob,filename(s.title)+'_참고사진.jpg');toast('사진 모음을 저장했습니다. AI 요청문과 함께 첨부하세요.');}},'image/jpeg',.92);
    }catch(error){toast(error.message);}
  };
  function printBoard(){$('print-board').innerHTML=state.scenes.map((s,i)=>`<article class="print-scene"><p class="print-caption">${esc(state.name)} · SCENE ${String(i+1).padStart(2,'0')}</p><h1>${esc(s.title)}</h1>${s.result?`<img class="print-result" src="${s.result.data}" alt="생성 결과">`:'<p>생성 결과 미등록 · 참고사진으로 구성한 촬영 계획</p>'}<p class="print-caption">AI 참고 시안 · 실제 촬영 결과와 다를 수 있음</p><div class="print-meta"><div><b>분위기 / 포즈</b><p>${esc(s.mood)}\n${esc(s.pose)}</p></div><div><b>의상 / 헤어</b><p>${esc(s.outfit)}\n${esc(s.hair)}</p></div></div>${s.memo?`<p><b>촬영 메모</b><br>${esc(s.memo)}</p>`:''}<div class="print-refs">${C.refs(state,s).filter(r=>!['bride','groom'].includes(r.key)).map(r=>`<figure><img src="${r.image.data}" alt="${r.label}"><figcaption>${r.label}</figcaption></figure>`).join('')}</div></article>`).join('');}
  window.addEventListener('beforeprint',printBoard);
  $('print-project').onclick=async()=>{printBoard();await Promise.all(Array.from($('print-board').querySelectorAll('img')).map(img=>img.decode().catch(()=>{})));window.print();};
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  $('copy-install').onclick=async()=>{const message='https://github.com/dongjoo-cpf19b/tistory_wedding_dj\n\n이 저장소의 README.md와 START_HERE.md를 읽고 웨딩 시안 만들기를 내가 사용할 수 있게 설치해 줘. 현재 AI 환경에서 지원되는 방식으로 개인용 사이트나 실행 가능한 HTML 파일을 제공해 줘. 별도 유료 API나 새 유료 서비스를 연결하지 말고, 지금 사용할 수 있는 기능으로 진행해 줘. 설치 뒤에는 스튜디오 여부부터 한 단계씩 안내해 줘. 신랑·신부 얼굴사진은 선택이야.';try{await navigator.clipboard.writeText(message);toast('설치 요청을 복사했습니다. 본인이 쓰는 AI 대화에 붙여넣어 주세요.');}catch{prompt('아래 설치 요청을 복사해 본인의 AI에 붙여넣어 주세요.',message);}};
  function agentStatus(message){$('agent-status').textContent=message;}
  $('agent-consent').onchange=()=>{$('prepare-ai').disabled=!agentConnected||!$('agent-consent').checked;if(!$('agent-consent').checked){pendingRequest=null;$('cancel-ai').hidden=true;agentStatus('AI 전달을 해제했습니다.');}};
  $('prepare-ai').onclick=()=>{if(!agentConnected||!$('agent-consent').checked)return;const s=current();if(!C.studio(state,s)){toast('스튜디오 사진 또는 가상 씬을 먼저 선택해 주세요.');return;}pendingRequest={id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),sceneId:s.id,title:s.title,prompt:C.prompt(state,s),refs:C.refs(state,s).map(r=>({...r,image:{...r.image}}))};$('cancel-ai').hidden=false;agentStatus('전달 준비 완료. 이 앱을 연 AI 대화에서 “준비한 웨딩 시안을 생성해 줘”라고 요청하세요. 준비한 시점의 사진과 설정을 전달합니다.');};
  $('cancel-ai').onclick=()=>{pendingRequest=null;$('cancel-ai').hidden=true;agentStatus('전달을 취소했습니다. AI에 이미 전달된 자료는 회수되지 않습니다.');};
  async function connectAgent(){
    const registry=document.modelContext;
    if(typeof registry?.registerTool!=='function'){$('agent-capability').textContent='현재 브라우저는 AI 연결을 지원하지 않습니다. 아래 직접 전달 기능을 이용할 수 있습니다.';return;}
    const lifecycle=new AbortController();
    const requireRequest=id=>{if(!$('agent-consent').checked||!pendingRequest||id!==pendingRequest.id)throw Error('사용자가 준비한 유효한 시안 요청이 없습니다. 화면에서 사진 전달을 확인하고 시안을 준비해야 합니다.');return pendingRequest;};
    const emptySchema={type:'object',properties:{},additionalProperties:false};
    try{
      await registry.registerTool({name:'read_wedding_request',description:'Read the wedding scene request explicitly prepared by the user. Does not generate an image. References are available only after the user enables sharing and prepares the request.',annotations:{readOnlyHint:true,untrustedContentHint:true},inputSchema:emptySchema,execute(){if(!$('agent-consent').checked||!pendingRequest)return {ready:false};const r=pendingRequest;return {ready:true,request_id:r.id,title:r.title,prompt:r.prompt,references:r.refs.map((v,i)=>({index:i,role:v.label})),generation:'Use the current assistant native image generation tool only if available and authorized. Do not use paid external APIs. This tool itself does not supply image generation.'};}},{signal:lifecycle.signal});
      await registry.registerTool({name:'read_wedding_reference',description:'Read one image from the user-prepared wedding request for use by the current AI. Requires the exact request ID and reference index from read_wedding_request.',annotations:{readOnlyHint:true,untrustedContentHint:true},inputSchema:{type:'object',properties:{request_id:{type:'string'},index:{type:'integer',minimum:0,maximum:4}},required:['request_id','index'],additionalProperties:false},execute(input){if(!input||typeof input.request_id!=='string'||!Number.isInteger(input.index))throw Error('요청 ID와 사진 번호를 확인해 주세요.');const r=requireRequest(input.request_id),v=r.refs[input.index];if(!v)throw Error('해당 참고사진이 없습니다.');const [head,data]=v.image.data.split(',');return {request_id:r.id,index:input.index,role:v.label,content:[{type:'image',mimeType:head.slice(5).split(';')[0],data}]};}},{signal:lifecycle.signal});
      await registry.registerTool({name:'save_wedding_result',description:'Add an already generated image to the prepared wedding scene. This saves the supplied result in browser memory; it does not generate an image. Requires a PNG/JPEG/WebP base64 data URL and the same request ID.',inputSchema:{type:'object',properties:{request_id:{type:'string'},image_data_url:{type:'string'}},required:['request_id','image_data_url'],additionalProperties:false},async execute(input){if(!input||typeof input.request_id!=='string'||!C.validImage(input.image_data_url))throw Error('올바른 요청 ID와 이미지 데이터가 필요합니다.');const r=requireRequest(input.request_id),s=state.scenes.find(s=>s.id===r.sceneId);if(!s)throw Error('요청한 씬이 삭제되었습니다.');const blob=blobOf(input.image_data_url),photo=await readImage(new File([blob],'AI 생성 결과',{type:blob.type}));requireRequest(input.request_id);if(!state.scenes.includes(s))throw Error('프로젝트가 변경되었습니다.');s.result=photo;active=s.id;dirty=true;pendingRequest=null;$('cancel-ai').hidden=true;render();agentStatus('AI가 생성한 시안을 받았습니다. 프로젝트를 저장해 주세요.');return {saved:true,scene:s.title};}},{signal:lifecycle.signal});
      agentConnected=true;$('agent-capability').textContent='AI 브라우저 연결 사용 가능 · 현재 대화의 AI가 준비한 시안을 읽고 결과를 전달할 수 있습니다.';$('prepare-ai').disabled=!$('agent-consent').checked;agentStatus('사진 전달을 확인한 뒤 시안을 준비해 주세요. 이미지 생성 기능은 현재 AI가 지원해야 합니다.');
    }catch{lifecycle.abort();$('agent-capability').textContent='AI 연결을 설정하지 못했습니다. 아래 직접 전달 기능을 이용해 주세요.';}
  }
  render();
  connectAgent();
})();
