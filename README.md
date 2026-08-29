> ⚠️ **DISCLAIMER:** This prototype is currently under active development. The codebase, architecture, and features are highly experimental and are subject to drastic changes without notice. 

# 🌾 Open Network Agricultural Bridge

A Zero-UI, Backend-as-a-Service (BaaS) Seller Node designed to bridge digitally excluded smallholder farmers directly to decentralized commerce networks (like ONDC/Beckn). 

By combining conversational AI, computer vision, and the Beckn protocol, this platform allows agricultural producers to list inventory, price goods, and verify crop quality simply by sending a WhatsApp voice note and a photo.

## 🚀 Key Features

* **Absolute Inclusivity (Zero-UI):** Farmers interact exclusively via WhatsApp/SMS/IVR. No apps to download, no complex forms to fill.
* **Multimodal AI Processing:** Instantly translates regional audio (Hinglish/dialects) into structured JSON catalog data using advanced ASR and NLU.
* **Algorithmic Quality Grading:** Employs computer vision to objectively grade crop photos, generating trustless, verifiable quality certificates.
* **Automated BPP Operations:** Acts as a Beckn Provider Platform (BPP), abstracting the complexity of digital signatures, schema mappings, and Open Network discovery.
* **Nested Logistics Matchmaking:** Automatically operates as a Buyer App (BAP) post-checkout to discover, book, and track optimal rural freight carriers.

## 🏗️ Architecture Overview

The system operates across four distinct layers:
1. **Data Ingestion:** Omnichannel API gateways (WhatsApp) & Message Brokers (Kafka/RabbitMQ).
2. **AI & Storage:** ASR/NLU for audio extraction, EfficientNet for image grading, and IPFS for decentralized proof of quality.
3. **Network Integration:** Protocol translation (Beckn schema mapping) and Ed25519 cryptographic signing for ONDC compatibility.
4. **Order & Logistics Execution:** Distributed concurrency (Redis Redlock), payment confirmation state machines, and real-time telemetry tracking.

## 🛠️ Tech Stack (Prototype)

* **Backend Environment:** Node.js, Express.js
* **AI/ML:** Google Gemini 1.5 Flash (Multimodal API for Audio & Vision parsing)
* **Messaging Infrastructure:** Meta WhatsApp Cloud API
* **Frontend (Buyer BAP):** React 18, Tailwind CSS, Babel
* **Network Protocol:** Beckn/ONDC specifications

## ⚙️ Local Development Setup

### 1. Prerequisites
* Node.js (v18 or higher)
* A Meta Developer Account (for WhatsApp API tokens)
* A Google AI Studio API Key (for Gemini)
* Ngrok (for local webhook testing)
