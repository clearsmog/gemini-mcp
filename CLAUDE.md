# Gemini MCP Server Project Guide

This document provides essential information for Claude when working with this Gemini MCP server project.

## Project Overview

This project is an MCP (Model Context Protocol) server that connects Claude to Google's Gemini 3 AI models. It enables bidirectional collaboration between Claude and Gemini, allowing them to work together by sharing capabilities and agent tools.

**Version:** 0.9.0-custom
**Package:** @rlabs-inc/gemini-mcp
**MCP Registry:** io.github.rlabs-inc/gemini-mcp

## Key Components

- `src/index.ts`: Dual-mode entry point (MCP server or CLI)
- `src/server.ts`: MCP server implementation
- `src/cli/`: CLI implementation with themes and commands
- `src/gemini-client.ts`: Client for Google's Generative AI API (includes thinking levels, image/video generation)
- `src/utils/logger.ts`: Logging utilities with configurable verbosity
- `src/tools/*.ts`: Various tool implementations for integration with Claude Code

## Tools

Tool details are discovered dynamically via MCP. This table maps tool groups to source files.

| Tool Group | File | Description |
|------------|------|-------------|
| Query | `query.ts` | Direct queries to Gemini with thinking level control |
| Brainstorm | `brainstorm.ts` | Collaborative brainstorming between Claude and Gemini |
| Analyze | `analyze.ts` | Code and text analysis |
| Summarize | `summarize.ts` | Content summarization at different detail levels |
| Image Gen | `image-gen.ts` | Image generation with Nano Banana Pro (see Gemini 3 section below) |
| Image Edit | `image-edit.ts` | Multi-turn conversational image editing sessions |
| Video Gen | `video-gen.ts` | Async video generation with Veo (poll for results) |
| Code Exec | `code-exec.ts` | Python execution (numpy, pandas, matplotlib, scipy, sklearn, tf) |
| Search | `search.ts` | Real-time web search with inline citations |
| Structured | `structured.ts` | JSON responses with schema validation; entity extraction |
| YouTube | `youtube.ts` | Video analysis and summarization by URL |
| Document | `document.ts` | PDF, DOCX, spreadsheet analysis and table extraction |
| URL Context | `url-context.ts` | Analyze, compare, and extract data from URLs |
| Cache | `cache.ts` | Context caching for repeated queries on large documents |
| Speech/TTS | `speech.ts` | Text-to-speech (30 voices) and multi-speaker dialogue |
| Token Count | `token-count.ts` | Token counting and cost estimation |
| Deep Research | `deep-research.ts` | Autonomous multi-step research (5-60 min async; saved to `GEMINI_OUTPUT_DIR`) |
| Image Analysis | `image-analyze.ts` | Object detection with bounding boxes (by @acreeger) |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | - | Google Gemini API key |
| `GEMINI_MODEL` | No | - | Override model for init test |
| `GEMINI_PRO_MODEL` | No | `gemini-3.1-pro-preview` | Pro model (Gemini 3.1) |
| `GEMINI_FLASH_MODEL` | No | `gemini-3-flash-preview` | Flash model (Gemini 3) |
| `GEMINI_IMAGE_MODEL` | No | `gemini-3.1-flash-image-preview` | Image model (Nano Banana 2) |
| `GEMINI_VIDEO_MODEL` | No | `veo-2.0-generate-001` | Video model |
| `GEMINI_SPEECH_MODEL` | No | `gemini-2.5-flash-preview-tts` | TTS model |
| `GEMINI_CACHE_MODEL` | No | `gemini-2.0-flash-001` | Context caching model |
| `GEMINI_OUTPUT_DIR` | No | `~/.cache/gemini-mcp/` | Output directory (platform-aware) |
| `VERBOSE` | No | `false` | Enable verbose logging |
| `QUIET` | No | `false` | Minimize logging |
| `GEMINI_ENABLED_TOOLS` | No | - | Comma-separated list of tool groups to load |
| `GEMINI_TOOL_PRESET` | No | - | Preset profile: minimal, text, image, research, media, focused, full |

## Command Line Options

- `-v, --verbose`: Enable verbose logging
- `-q, --quiet`: Run in quiet mode
- `-h, --help`: Show help message

## Installation

```bash
claude mcp add gemini -s user -- env GEMINI_API_KEY=YOUR_KEY npx -y @rlabs-inc/gemini-mcp
```

## Development Commands

```bash
bun install        # Install dependencies
bun run build      # Build the project
bun run dev        # Run in development mode (with watch)
bun run dev -- -v  # Run with verbose logging
bun run typecheck  # Type check without emitting
bun run format     # Format code with Prettier
bun run lint       # Lint code with ESLint
```

## Dependencies

- `@google/genai`: ^1.34.0 - Google Generative AI SDK
- `@modelcontextprotocol/sdk`: 1.22.0 - MCP SDK (pinned; 1.23.0+ causes TypeScript OOM)
- `zod`: 3.24.3 - Schema validation (pinned for compatibility with MCP SDK)
- `zod-to-json-schema`: 3.24.5 - Zod to JSON Schema conversion (pinned; 3.25+ requires zod/v3 export)

## Architecture Notes

- The server uses stdio transport for communication with Claude Code
- Image generation returns base64 data that Claude can render inline
- Video generation is async - returns operation ID for polling
- Generated files are saved to `GEMINI_OUTPUT_DIR`
- Thinking levels control reasoning depth in Gemini 3
- Image editing uses chat sessions with automatic thought signature handling

## Gemini 3 Specific Features

### Thinking Levels
- `minimal`: Fastest, minimal reasoning (Flash only)
- `low`: Fast responses, basic reasoning
- `medium`: Balanced reasoning (Flash only)
- `high`: Deep reasoning for complex tasks (default)

### Nano Banana 2 (Image Generation)
- Model: `gemini-3.1-flash-image-preview`
- Resolutions: 1K, 2K (default), 4K
- 14 aspect ratios (including 1:4, 4:1, 1:8, 8:1 for banners)
- Thinking level support (minimal/low/medium/high, default: high)
- Google Search grounding ON by default
- High-fidelity text rendering
- Note: `imageSearch` grounding type is Python SDK only (TS SDK lacks `searchTypes` field)

### Thought Signatures
- Handled automatically by the SDK when using chat sessions
- Required for multi-turn image editing
- Preserved in conversation history for function calling

## Key Changes in v0.9.0-custom

- **Centralized model config**: All tool files now use singleton `genAI` and getter functions from `gemini-client.ts`
- **New env vars**: `GEMINI_SPEECH_MODEL`, `GEMINI_CACHE_MODEL` for overriding speech/cache model defaults
- **Updated model defaults**: Pro model now defaults to `gemini-3.1-pro-preview`, Image model to `gemini-3.1-flash-image-preview`
- **Auto-invoke**: All `mcp__gemini__*` tools auto-invoke without permission prompts

## Future Roadmap

See `docs/ROADMAP.md` for implementation plan. Remaining features:
- **Lyria Music Generation**: Real-time music via WebSocket (complex)
- **Live Streaming API**: Real-time bidirectional streaming
- **File Search**: Search through uploaded file stores
