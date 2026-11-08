# AI Chat Platform

A multi-model AI chat application inspired by Venice AI.

## Vision

Build a polished, privacy-conscious AI workspace with a unified chat interface and a model gateway that connects to providers through officially supported APIs, SDKs, OAuth flows, or other explicitly authorized integrations.

A proxy is a routing and protocol-translation layer; it does not grant access to paid models or bypass provider authentication, subscriptions, rate limits, or terms.

## Planned capabilities

- Unified chat UI with streaming responses
- Model catalog and model picker
- Provider and connection management
- Pluggable gateway adapters
- Conversation history and user settings
- File attachments and image understanding
- Optional web search and image-generation integrations
- Clear privacy controls and secure credential storage

## Initial architecture

- Frontend: Next.js + TypeScript
- Backend: Node.js service (Fastify)
- Gateway: provider adapter interface with per-provider authentication and protocol handling
- Database: PostgreSQL
- Deployment: frontend and persistent backend deployed separately

## Development principles

1. Verify each provider's official access method before implementing an adapter.
2. Never expose provider credentials in browser code or commit secrets.
3. Do not implement credential theft, session-cookie extraction, or subscription/paywall bypasses.
4. Keep the gateway modular so providers can be added or removed independently.
5. Start with a working text-chat MVP before adding tools and multimodal features.

## Status

Repository initialized. Product name and visual identity are not final.
