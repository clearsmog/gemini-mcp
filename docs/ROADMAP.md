# Gemini MCP Server - Roadmap

**Version:** 0.9.0-custom
**Status:** 30+ tools implemented across 18 tool groups

Previous roadmap archived to `ROADMAP-v0.2-archive.md`.

---

## Remaining Unimplemented Features

### Lyria Music Generation
- **Model:** `lyria-realtime-exp`
- **Complexity:** High -- requires WebSocket for real-time streaming
- **Status:** API available but transport layer needs work

### Live Streaming API
- **Model:** Uses existing Gemini models via streaming endpoints
- **Complexity:** High -- bidirectional real-time streaming
- **Features:** Voice conversations, live video analysis, interactive sessions

### File Search
- **Config:** `tools: [{ fileSearch: {} }]`
- **Complexity:** Medium -- search through uploaded file stores
- **Status:** API available, needs tool wrapper

---

## Recently Completed (v0.9.0-custom)

- Centralized model config (singleton `genAI`, getter functions)
- Added `GEMINI_SPEECH_MODEL` and `GEMINI_CACHE_MODEL` env var overrides
- Updated model defaults to Gemini 3.1
- Auto-invoke for all gemini MCP tools
