# 페르소나 프사 인식

마리나라 2.5.1의 RP 요청에 현재 선택한 페르소나의 프로필 이미지를 선택적으로 추가하는 비공식 서버 패치입니다. 기본값은 꺼짐이며, 설정은 채팅방별로 저장됩니다. 이미지 인식을 지원하는 대화 모델이 필요합니다.

이미지는 RP 요청에만 전달하며 채팅 기록의 첨부 이미지로 저장하지 않습니다. 페르소나를 바꾸면 새로 선택한 페르소나의 프사를 사용합니다. 프사가 없거나 6 MiB를 넘으면 보내지 않습니다. 이미지 입력은 모델의 입력 토큰으로 과금되며, 비용은 이미지와 모델에 따라 다릅니다. 텍스트 설명과 프사가 충돌하지 않도록 외형 설정도 확인해 주세요.

## Docker Compose 설치

서버에 접속한 뒤 다음 명령을 실행합니다. 기존 Compose 파일은 수정하지 않으며, 현재 컨테이너의 `NODE_OPTIONS`를 유지한 별도 Compose 파일을 생성합니다.

```bash
curl -fsSL https://raw.githubusercontent.com/tlsiddl/marinara-persona-vision/main/install.sh | bash
```

설치 후 마리나라 설정의 외부 확장에서 [화면 확장 ZIP](deliverable/persona-vision-0.1.2.personal-extension.zip)을 가져와 검토 후 켭니다. 채팅방을 열고 **프사 인식** 버튼에서 이 방의 전송을 켭니다. 화면 확장만 설치하면 작동하지 않습니다.

설치 과정에서 서버가 재생성됩니다. 여러 마리나라 컨테이너가 있으면 `MARINARA_CONTAINER=컨테이너이름 bash install.sh`로 대상을 지정하세요. 서버 로그에 `[persona-vision] app: ok`와 `[persona-vision] prompt: ok`가 보여야 합니다. `failed`라면 사용 중인 서버 파일이 지원 대상과 달라 해당 패치는 적용되지 않습니다.

설치 명령이 출력하는 `docker compose -f ... -f docker-compose.persona-vision.yml up -d`를 보관하세요. 나중에 `docker compose up`을 직접 실행할 때 이 파일을 빠뜨리면 프사 인식 패치가 빠집니다. 기억 서재의 설정도 기존 Compose 파일에 남아 있어야 합니다.

## 작동 범위

- RP 답변 생성, 다시 생성 및 이어 쓰기의 모델 입력에 사용합니다. 유저 대신 쓰기(impersonate)는 제외합니다.
- 이미지가 없거나 지원하지 않는 형식이면 전송하지 않습니다. PNG, JPEG, WebP를 지원합니다.
- 프사는 모델이 새로 호출될 때마다 전송되므로 속도와 비용에 영향을 줄 수 있습니다.
- 서버 설정과 이미지는 사용하는 모델/API 제공자에게 전송됩니다.
- Node.js 22.15 이상이 필요하며 마리나라 2.5.1만 대상으로 합니다. 다른 버전은 별도 검증 전까지 지원하지 않습니다.

## 개발 검사

```bash
node --test tests/*.test.cjs
```
