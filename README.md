# Fog Chess Ready

자바스크립트 기반 지식이 없어도 실행할 수 있게 구성한 웹 체스 프로젝트입니다.

## 실행 방법

VS Code에서 이 폴더를 그대로 엽니다.

터미널에서 아래 명령어를 입력합니다.

```bat
npm install
npm run dev
```

브라우저에서 아래 주소를 엽니다.

```txt
http://localhost:5173/
```

## 중요

반드시 `package.json`이 보이는 폴더에서 `npm install`을 실행해야 합니다.

정상 폴더 구조:

```txt
fog-chess-ready
├─ package.json
├─ index.html
├─ vite.config.ts
├─ tsconfig.json
├─ public
├─ scripts
└─ src
```

## 현재 기능

- VS AI 체스 가능
- 체스 규칙 검증 가능
- AI 난이도 선택 가능
- Stockfish 설치 성공 시 자동 사용
- Stockfish 사용 실패 시 내장 대체 AI로 자동 진행
- 안개 체스 코드 포함
- WebRTC, Firebase 멀티플레이용 파일 포함

## PowerShell 오류가 나면

VS Code 터미널이 PowerShell이라서 npm 실행이 막히는 경우가 있습니다.
그 경우 VS Code 터미널에서 Command Prompt를 선택하고 다시 실행하세요.

```bat
npm install
npm run dev
```
