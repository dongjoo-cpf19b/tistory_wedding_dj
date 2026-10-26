# AI별 지원 범위

확인일: 2026-10-27. 계정·앱·설정에 따라 이용 가능한 기능이 다를 수 있습니다. 설치 AI는 실제 사용 가능한 도구를 기준으로 판단합니다.

| 환경 | 패키지 실행·제공 | 사진형 시안 생성 |
| --- | --- | --- |
| ChatGPT | Sites가 제공되는 환경에서 개인 사이트, 파일 생성이 지원되는 환경에서 HTML 제공 | 지원되는 대화에서 참고사진을 첨부해 이미지 생성 |
| Claude | Artifacts·파일 생성이 지원되는 환경에서 HTML·웹앱 제작과 제공 | 자체 사진 생성 기능 없음. 별도 도구가 필요하며 비용·한도는 해당 도구 기준 |
| PC 접근 가능한 AI 도구 | 허용된 폴더에 파일 배치 가능 | 현재 제공되는 이미지 도구에 따름 |

사이트를 생성하는 기능과 사이트에서 AI를 호출하는 기능은 별개입니다. 이 패키지는 대화의 이미지 생성 기능을 활용하는 방식이며 구독 서비스를 자동 호출하지 않습니다. 패키지 무료 제공이 모든 AI 구독료·호스팅·한도 초과 사용료의 면제를 뜻하지 않습니다.

공식 문서:

- [ChatGPT Sites](https://learn.chatgpt.com/docs/sites)
- [ChatGPT에서 사이트 만들기](https://learn.chatgpt.com/docs/sites/creating-a-site)
- [ChatGPT 이미지 생성](https://learn.chatgpt.com/docs/image-generation)
- [Claude Artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them)
- [Claude의 이미지 생성 지원 범위](https://support.claude.com/en/articles/9002504-can-claude-produce-images)

## 외부 앱 연결과 AI 대화 연결

- 외부 앱의 Sign in with ChatGPT: 사용자 구독 한도 연결을 제공하나 현재 이미지 생성은 지원하지 않습니다. [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)
- 본 패키지의 WebMCP: 열린 앱의 준비된 요청을 현재 AI에 전달하고 결과를 받는 도구입니다. 자체 이미지 생성 기능이나 구독 권한을 제공하지 않습니다. 이미지 생성은 연결된 AI 대화의 도구로 실행합니다.
- 앱의 준비 버튼만으로 AI를 자동 호출하지 않습니다. 사용자가 AI 대화에서 생성을 요청해야 합니다.
