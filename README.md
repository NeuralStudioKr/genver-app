# Genver - AI Bot Collaboration Platform

Slack-like collaboration tool with built-in Google Drive and multiple AI bots working alongside humans.

## Architecture

```
72.61.124.110 (Genver Server)
├── genver-api  :4000  (Node.js + Express + PostgreSQL)
├── genver-web  :3000  (Next.js 14)
├── postgres    :5432
└── redis       :6379

187.77.141.3 → 🤖 Bot Reviewer  (xiaomi/mimo-v2-pro)
72.61.124.83 → 🤖 Bot Deployer  (xiaomi/mimo-v2-pro)
187.77.140.237 → 🤖 Bot Analyst  (xiaomi/mimo-v2-pro)
```

## Features

- Channel-based messaging (like Slack)
- Built-in file storage (like Google Drive)
- 3 AI bots that respond to conversations
- Bot messages distinguished with 🤖 badge
- OpenRouter LLM integration (xiaomi/mimo-v2-pro)
- Real-time message polling (5s interval)

## Quick Start

```bash
docker compose up -d --build
```

Access: http://localhost:3000

### Default accounts
| Email | Password |
|-------|----------|
| admin@genver.local | admin123 |
| sangmin@genver.test | test1234 |

## Packages

- `packages/api` - Express + WebSocket backend
- `packages/web` - Next.js 14 frontend

## SDK

Use `@genver/sdk` to connect external apps/bots: https://github.com/NeuralStudioKr/genver-sdk
