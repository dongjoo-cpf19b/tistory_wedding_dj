(function(root){
  'use strict';
  const roles={bride:'신부 얼굴',groom:'신랑 얼굴',studio:'스튜디오 씬',dress:'드레스·의상',hairRef:'헤어 참고'};
  const moods=['자연스럽고 따뜻하게','밝고 사랑스럽게','차분하고 우아하게','선명하고 감각적으로','필름 사진처럼'];
  const sizes=['1024x1536','1536x1024','1024x1024'];
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const scene=()=>({id:uid(),title:'새로운 촬영 씬',mood:moods[0],size:sizes[0],pose:'',outfit:'',hair:'',memo:'',studio:null,dress:null,hairRef:null,result:null});
  const project=()=>({format:'tistory-wedding-dj',version:1,name:'우리의 웨딩 촬영',people:{bride:null,groom:null},scenes:[scene()]});
  function validImage(value){return typeof value==='string'&&value.length<12*1024*1024&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);}
  function image(value){if(value===null||value===undefined)return null;if(!value||typeof value!=='object'||!validImage(value.data))throw Error('지원하지 않는 사진 데이터입니다.');return {name:String(value.name||'reference').slice(0,160),data:value.data};}
  function text(value,max){return typeof value==='string'?value.slice(0,max):'';}
  function normalize(input){
    if(!input||input.format!=='tistory-wedding-dj'||input.version!==1||!Array.isArray(input.scenes)||input.scenes.length<1||input.scenes.length>12)throw Error('이 도구에서 저장한 프로젝트 파일을 선택해 주세요.');
    return {format:input.format,version:1,name:text(input.name,80)||'우리의 웨딩 촬영',people:{bride:image(input.people?.bride),groom:image(input.people?.groom)},scenes:input.scenes.map(s=>{
      if(!s||typeof s!=='object')throw Error('씬 정보가 올바르지 않습니다.');
      return {id:uid(),title:text(s.title,80)||'새로운 촬영 씬',mood:moods.includes(s.mood)?s.mood:moods[0],size:sizes.includes(s.size)?s.size:sizes[0],pose:text(s.pose,1200),outfit:text(s.outfit,300),hair:text(s.hair,300),memo:text(s.memo,1200),studio:image(s.studio),dress:image(s.dress),hairRef:image(s.hairRef),result:image(s.result)};
    })};
  }
  function refs(p,s){return Object.keys(roles).map(key=>({key,label:roles[key],image:p.people[key]||s[key]})).filter(r=>r.image);}
  function prompt(p,s){const photos=refs(p,s);return [
    '첨부한 참고사진으로 신랑·신부의 웨딩 촬영 참고 시안 1장을 만들어 주세요.',
    '참고사진 모음의 번호별 역할 (개별 사진을 첨부하는 경우에도 동일한 순서):',
    ...photos.map((r,i)=>`${i+1}. ${r.label}`),
    photos.length?'각 사진은 위 역할에만 사용해 주세요. 스튜디오 사진 속 모델의 얼굴은 사용하지 마세요.':'먼저 인물과 스튜디오 참고사진을 추가해 주세요.',
    '신랑과 신부는 각각의 얼굴 참고사진을 기준으로 구분하고, 얼굴의 주요 특징과 자연스러운 피부 표현을 최대한 유지해 주세요. 두 사람의 얼굴을 섞거나 새로운 인물로 바꾸지 마세요.',
    '스튜디오 씬의 공간 구조, 배경, 주요 소품과 빛의 방향을 참고하고, 헤어·드레스 참고사진은 스타일에만 반영해 주세요.',
    `씬: ${s.title}`,`분위기: ${s.mood}`,`포즈·구도: ${s.pose||'두 사람이 자연스럽게 함께 있는 구도'}`,`드레스·의상: ${s.outfit||'첨부한 의상 참고사진 기준'}`,`헤어·소품: ${s.hair||'첨부한 헤어 참고사진 기준'}`,`화면 크기: ${s.size}`, 
    '참고사진의 번호·라벨·테두리, 글자와 워터마크는 결과물에 넣지 마세요. 자연스러운 인체 비율과 손 모양, 실제 촬영 가능한 구도로 표현해 주세요.'
  ].join('\n');}
  const api={roles,moods,sizes,scene,project,normalize,validImage,refs,prompt};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WeddingCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
