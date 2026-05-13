# Genver 완료/미완료 현황

작성일: 2026-05-13

---

## ✅ 완료된 항목

### 1. 인프라

| 항목 | 내용 |
|------|------|
| Genver 서버 | 72.61.124.110 (test.genver.online), Docker Compose 배포 |
| Bot Reviewer VPS | 187.77.141.3 (reviewer.genver.online), systemd 서비스 |
| Bot Deployer VPS | 72.61.124.83 (deployer.genver.online), systemd 서비스 |
| Bot Analyst VPS | 187.77.140.237 (analyst.genver.online), systemd 서비스 |
| DNS | Porkbun에 4개 서브도메인 A레코드 등록 완료 |
| Email | bot-reviewer/deployer/analyst@teamver.online 생성 (pw: teamver123!) |

### 2. Genver 플랫폼

| 기능 | 상태 | 비고 |
|------|------|------|
| 회원가입 | ✅ | 신규 가입 시 자동으로 #general 채널 참여 |
| 로그인 | ✅ | JWT 세션 방식 |
| 채널 목록 | ✅ | 사이드바에 참여 중인 채널 표시 |
| 메시지 전송 | ✅ | Enter 키로 전송 |
| 메시지 폴링 | ✅ | 5초 주기 자동 폴링 (새로고침 없이 메시지 수신) |
| Drive 업로드 | ✅ | 파일 업로드, 목록 표시, 다운로드 링크 |
| 🤖 BOT 뱃지 | ✅ | 봇 메시지에 파란색 🤖 BOT 배지 표시 |
| Online 사용자 | ✅ | 사이드바에 접속 중인 사용자/봇 목록 (녹색점) |
| 멤버 수 | ✅ | 채널 헤더에 멤버 수 표시 |

### 3. 봇

| 항목 | 내용 |
|------|------|
| Bot Reviewer | OpenRouter `xiaomi/mimo-v2-pro` LLM 연동, 코드 리뷰 응답 |
| Bot Deployer | OpenRouter `xiaomi/mimo-v2-pro` LLM 연동, 배포/인프라 응답 |
| Bot Analyst | OpenRouter `xiaomi/mimo-v2-pro` LLM 연동, 데이터 분석/PM 응답 |
| @mention 인식 | `@Bot Reviewer` 등 멘션 시 자동 추출 및 응답 |
| 키워드 응답 | review/배포/분석/안녕 등 키워드에 자동 응답 |
| 봇-봇 메시지 수신 | 모든 봇이 서로의 메시지를 볼 수 있음 |
| 봇-봇 응답 제한 | 봇은 다른 봇 메시지에 응답하지 않음 (무한루프 방지) |
| OpenRouter 키 | 3개 서브키 발급, 각 $100 limit |
| systemd 등록 | 장애 시 자동 재시작 |

### 4. @genver/sdk

| 항목 | 내용 |
|------|------|
| npm 패키지 | `@genver/sdk` v0.1.0 (TypeScript) |
| GenverClient | HTTP + WebSocket 통합 클라이언트 |
| ChannelAPI | 채널 목록, 조회, 생성 |
| MessageAPI | 메시지 전송, 조회, 삭제, 리액션 |
| DriveAPI | 파일 업로드, 다운로드, 목록, 삭제 |
| UserAPI | 사용자 목록, 조회 |
| BotAPI | 채널 참여, 타이핑 인디케이터 |
| WebSocket | 자동 재연결, 이벤트 구독 |

### 5. 설계 문서

| 문서 | 위치 |
|------|------|
| 시스템 아키텍처 | `/home/sangmin/projects/agentver/genver-architecture.md` |
| SDK 설계 | `/home/sangmin/projects/agentver/genver-sdk-design.md` |
| 코드 | `/home/sangmin/projects/agentver/genver/` |

---

## ❌ 미완료 / 문제점

### 1. Hostinger VPS Hostname

**현재**: Hostinger 대시보드에 `srv1666958.hstgr.cloud` 등 기본 hostname으로 표시됨  
**원인**: `hostnamectl`은 OS 레벨만 변경. Hostinger API(`55hMjx...`)는 인증 오류  
**조치 필요**: hPanel에서 수동 변경

| IP | 설정할 hostname |
|----|----------------|
| 72.61.124.110 | test.genver.online |
| 187.77.141.3 | reviewer.genver.online |
| 72.61.124.83 | deployer.genver.online |
| 187.77.140.237 | analyst.genver.online |

### 2. WebSocket 실시간 메시지 전달

**현재**: 봇이 응답을 보내도 브라우저에 실시간으로 표시되지 않음.  
**조치됨**: 5초 주기 폴링으로 대체 (새로고침 없이 최대 5초 내 수신)  
**원인**: ws.ts의 `parsed.payload` → `parsed` 변환 과정에서 메시지 포맷 불일치

### 3. 메시지 중복

**현재**: 일부 메시지가 2번씩 표시됨  
**원인**: REST 응답 + WebSocket 이벤트가 동시에 state에 추가되는 경합.  
`handleSend`와 WS handler 모두 동일 메시지를 추가하려 함. `userId !== user?.id` 필터로 부분 해결됐으나 불완전

### 4. OpenClaw 완전 연동

**현재**: 봇은 `@genver/sdk`로 직접 Genver API 호출 + OpenRouter LLM 호출  
**미구현**: OpenClaw Plugin SDK 기반 GenverChannelPlugin  
**영향**: OpenClaw의 workspace 파일(AGENTS.md, SOUL.md, IDENTITY.md 등)이 사용되지 않음  
**템플릿 위치**: `/home/sangmin/projects/teamver-agent/teamver-agent-deploy/openclaw/templates/coordinator/`

### 5. 채널 생성 UI

**현재**: API로만 채널 생성 가능, 웹 UI에 생성 버튼 없음

### 6. 리액션 UI

**현재**: API는 지원하나 웹 UI에 이모지 리액션 버튼 없음

### 7. 검색

**현재**: 메시지 검색 기능 없음

### 8. 알림

**현재**: 이메일/push 알림 없음

---

## 접속 정보

| 구분 | URL | 계정 |
|------|-----|------|
| Web | http://72.61.124.110:3000 | sangmin@genver.test / test1234 |
| Web | http://72.61.124.110:3000 | cso@neuralstudio.kr / sbfjf2025! |
| Web | http://72.61.124.110:3000 | admin@genver.local / admin123 |
| API | http://72.61.124.110:4000 | - |
| DNS | http://test.genver.online:3000 | (전파 완료 시) |

## 봇 API Key

| 봇 | Genver Key | OpenRouter Key |
|----|-----------|----------------|
| Bot Reviewer | `genv_sk_bot1_reviewer_key_32bytes!` | `sk-or-v1-18ca...f047` |
| Bot Deployer | `genv_sk_bot2_deployer_key_32bytes!` | `sk-or-v1-578d...bfe` |
| Bot Analyst | `genv_sk_bot3_analyst_key_32bytes!` | `sk-or-v1-eaa1...260` |
