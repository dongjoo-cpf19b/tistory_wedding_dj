/* Wedding concept board. No external scripts, analytics or automatic photo uploads. */
(() => {
  'use strict';
  const C=window.WeddingCore,$=id=>document.getElementById(id);
  let state=C.project(),active=state.scenes[0].id,dirty=false,busy=false,apiReady=false,toastTimer;
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
  function refreshAssets(){const s=current();$('people').innerHTML=['bride','groom'].map(k=>assetMarkup(k,state.people[k])).join('');$('references').innerHTML=['studio','dress','hairRef'].map(k=>assetMarkup(k,s[k])).join('');}
  function refreshList(){$('scene-count').textContent=state.scenes.length;$('scene-list').innerHTML=state.scenes.map((s,i)=>`<button class="scene-item ${s.id===active?'active':''}" data-scene="${s.id}" aria-current="${s.id===active?'true':'false'}"><span class="num">${String(i+1).padStart(2,'0')}</span><span>${esc(s.title)}</span></button>`).join('');$('add-scene').disabled=state.scenes.length>=12;$('remove-scene').disabled=state.scenes.length===1;}
  function refreshResult(){const s=current(),box=$('result-preview');box.style.aspectRatio=s.size.replace('x',' / ');box.classList.toggle('has-image',!!s.result);box.innerHTML=s.result?`<img src="${s.result.data}" alt="${esc(s.title)} 생성 결과">`:'<div class="empty-art">W.</div><p>상상한 장면을<br>이곳에 담아 보세요.</p><small>AI에서 만든 이미지를 추가하면<br>촬영 시안에 함께 저장됩니다.</small>';$('download-result').disabled=!s.result;$('clear-result').disabled=!s.result;$('result-meta').innerHTML=[['분위기',s.mood],['포즈·구도',s.pose],['의상 / 헤어',[s.outfit,s.hair].filter(Boolean).join(' / ')],['촬영 메모',s.memo]].filter(([,v])=>v).map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');}
  function refreshPrompt(){$('prompt').value=C.prompt(state,current());}
  function render(){const s=current();$('project-name').value=state.name;$('scene-title').value=s.title;for(const k of ['mood','size','pose','outfit','hair','memo'])$(k).value=s[k];$('scene-number').textContent=`02 · SCENE ${String(state.scenes.indexOf(s)+1).padStart(2,'0')}`;refreshAssets();refreshList();refreshPrompt();refreshResult();}
  $('project-name').addEventListener('input',e=>{state.name=e.target.value;dirty=true;});
  for(const [id,key] of [['scene-title','title'],...['mood','size','pose','outfit','hair','memo'].map(k=>[k,k])])$(id).addEventListener('input',e=>{current()[key]=e.target.value;dirty=true;refreshList();refreshPrompt();refreshResult();});
  document.addEventListener('change',async e=>{
    const key=e.target.dataset.photo;if(!key)return;
    const destination=['bride','groom'].includes(key)?state.people:current();
    try{destination[key]=await readImage(e.target.files[0]);dirty=true;refreshAssets();refreshPrompt();}catch(error){toast(error.message);}
  });
  document.addEventListener('click',e=>{const clear=e.target.closest('[data-clear]'),item=e.target.closest('[data-scene]');if(clear){const key=clear.dataset.clear;(['bride','groom'].includes(key)?state.people:current())[key]=null;dirty=true;refreshAssets();refreshPrompt();}if(item){active=item.dataset.scene;render();}});
  $('add-scene').onclick=()=>{if(state.scenes.length>=12)return;const s=C.scene();s.title=`촬영 씬 ${state.scenes.length+1}`;state.scenes.push(s);active=s.id;dirty=true;render();};
  $('remove-scene').onclick=()=>{if(state.scenes.length<2||!confirm('선택한 씬을 삭제할까요? 저장하지 않은 사진과 메모도 함께 지워집니다.'))return;state.scenes=state.scenes.filter(s=>s.id!==active);active=state.scenes[0].id;dirty=true;render();};
  $('result-file').onchange=async e=>{const s=current();try{s.result=await readImage(e.target.files[0]);dirty=true;refreshResult();toast('결과 이미지를 추가했습니다.');}catch(error){toast(error.message);}finally{e.target.value='';}};
  $('clear-result').onclick=()=>{current().result=null;dirty=true;refreshResult();};
  $('download-result').onclick=()=>{const s=current();if(s.result)download(blobOf(s.result.data),filename(s.title)+(s.result.data.startsWith('data:image/png')?'.png':'.jpg'));};
  $('save-project').onclick=()=>{download(new Blob([JSON.stringify(state)],{type:'application/json'}),filename(state.name)+'.wedding.json');dirty=false;toast('사진과 메모를 포함한 프로젝트 파일을 저장했습니다. 개인 파일로 보관하세요.');};
  $('load-project').onclick=()=>{if(!dirty||confirm('현재 작업을 불러온 파일로 바꿀까요? 필요한 경우 먼저 프로젝트를 저장하세요.'))$('project-file').click();};
  $('project-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>160*1024*1024)throw Error('프로젝트 파일은 160MB 이하만 불러올 수 있습니다.');const next=C.normalize(JSON.parse(await file.text()));state=next;active=state.scenes[0].id;dirty=false;render();toast('프로젝트를 불러왔습니다.');}catch(error){toast(error instanceof SyntaxError?'프로젝트 파일 형식이 올바르지 않습니다.':error.message);}finally{e.target.value='';}};
  $('copy-prompt').onclick=async()=>{refreshPrompt();try{await navigator.clipboard.writeText($('prompt').value);toast('요청문을 복사했습니다. 참고사진과 함께 AI에 전달하세요.');}catch{$('prompt').focus();$('prompt').select();toast('요청문이 선택되었습니다. 복사해서 AI에 전달하세요.');}};
  $('save-reference').onclick=async()=>{
    const s=current(),refs=C.refs(state,s);if(!refs.length){toast('참고사진을 먼저 추가해 주세요.');return;}
    try{const canvas=document.createElement('canvas'),cell=650,header=100;canvas.width=1300;canvas.height=header+Math.ceil(refs.length/2)*cell;const ctx=canvas.getContext('2d');ctx.fillStyle='#f7f5f1';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#344733';ctx.font='bold 28px sans-serif';ctx.fillText('웨딩 촬영 참고사진 · 번호별 역할을 구분해 주세요',30,58);
      for(let i=0;i<refs.length;i++){const r=refs[i],img=await loadImage(r.image.data),x=(i%2)*cell,y=header+Math.floor(i/2)*cell;ctx.fillStyle='#fff';ctx.fillRect(x+12,y+10,cell-24,cell-22);ctx.fillStyle='#344733';ctx.font='bold 24px sans-serif';ctx.fillText(`${i+1}. ${r.label}`,x+30,y+48);const scale=Math.min((cell-60)/img.width,(cell-100)/img.height),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,x+(cell-w)/2,y+75+(cell-100-h)/2,w,h);}
      canvas.toBlob(blob=>{if(blob){download(blob,filename(s.title)+'_참고사진.jpg');toast('사진 모음을 저장했습니다. AI 요청문과 함께 첨부하세요.');}},'image/jpeg',.92);
    }catch(error){toast(error.message);}
  };
  function printBoard(){$('print-board').innerHTML=state.scenes.map((s,i)=>`<article class="print-scene"><p class="print-caption">${esc(state.name)} · SCENE ${String(i+1).padStart(2,'0')}</p><h1>${esc(s.title)}</h1>${s.result?`<img class="print-result" src="${s.result.data}" alt="생성 결과">`:'<p>생성 결과 미등록 · 참고사진으로 구성한 촬영 계획</p>'}<p class="print-caption">AI 참고 시안 · 실제 촬영 결과와 다를 수 있음</p><div class="print-meta"><div><b>분위기 / 포즈</b><p>${esc(s.mood)}\n${esc(s.pose)}</p></div><div><b>의상 / 헤어</b><p>${esc(s.outfit)}\n${esc(s.hair)}</p></div></div>${s.memo?`<p><b>촬영 메모</b><br>${esc(s.memo)}</p>`:''}<div class="print-refs">${['studio','dress','hairRef'].filter(k=>s[k]).map(k=>`<figure><img src="${s[k].data}" alt="${C.roles[k]}"><figcaption>${C.roles[k]}</figcaption></figure>`).join('')}</div></article>`).join('');}
  window.addEventListener('beforeprint',printBoard);
  $('print-project').onclick=async()=>{printBoard();await Promise.all(Array.from($('print-board').querySelectorAll('img')).map(img=>img.decode().catch(()=>{})));window.print();};
  window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
  $('api-consent').onchange=()=>{$('generate').disabled=!apiReady||!$('api-consent').checked||busy;};
  $('generate').onclick=async()=>{
    if(busy||!apiReady||!$('api-consent').checked)return;
    const s=current();if(!state.people.bride||!state.people.groom||!s.studio){toast('신랑·신부 얼굴과 스튜디오 씬 사진을 먼저 추가해 주세요.');return;}
    busy=true;$('generate').disabled=true;$('generation-status').textContent='이미지 생성 중입니다. 몇 분 정도 걸릴 수 있습니다. 중복 요청하지 말고 기다려 주세요.';
    try{const response=await fetch('api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:C.prompt(state,s),images:C.refs(state,s).map(r=>r.image.data),size:s.size,consent:true})});const result=await response.json();if(!response.ok)throw Error(result.error||'생성에 실패했습니다.');if(!C.validImage(result.image))throw Error('결과 이미지 형식이 올바르지 않습니다.');s.result={name:'AI 생성 결과.png',data:result.image};dirty=true;refreshResult();$('generation-status').textContent='생성을 완료했습니다. 해당 씬을 확인하고 프로젝트를 저장하세요.';toast('AI 시안을 생성했습니다.');}catch(error){$('generation-status').textContent=error.message||'서버 연결을 확인해 주세요.';}finally{busy=false;$('generate').disabled=!apiReady||!$('api-consent').checked;}
  };
  render();
  if(['127.0.0.1','localhost'].includes(location.hostname)&&location.protocol==='http:')fetch('api/config').then(r=>r.ok?r.json():Promise.reject()).then(data=>{apiReady=!!data.enabled;$('api-status').textContent=apiReady?`로컬 API 연결 준비 완료 · ${data.model}`:'API 키가 설정되지 않았습니다. README의 로컬 API 실행 안내를 확인하세요.';}).catch(()=>{$('api-status').textContent='server.py로 실행하면 선택형 API 생성 기능을 사용할 수 있습니다.';});else $('api-status').textContent='웹 버전은 본인 AI를 활용하는 방식입니다. API 생성은 소스 코드를 내려받아 로컬에서 실행하세요.';
})();
