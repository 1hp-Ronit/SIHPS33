# PedKhata | Decentralized Agricultural Marketplace

![Beckn Protocol](https://img.shields.io/badge/Beckn_Protocol-v2.0.0-emerald)
![Node.js](https://img.shields.io/badge/Node.js-Express-success)
![AI Integration](https://img.shields.io/badge/AI-Gemini_1.5_Flash-orange)
![Docker](https://img.shields.io/badge/Docker-ONIX_Adapters-blue)
![WhatsApp API](https://img.shields.io/badge/Meta-WhatsApp_Business_API-green)

**PedKhata** is a decentralized, zero-friction agricultural commerce node built on the open **Beckn Protocol (v2.0.0)**. It enables non-technical farmers to list their produce directly onto an open network (like ONDC) using only WhatsApp text, voice notes, and images. 

Multimodal AI (Gemini 1.5 Flash) handles parsing, translation, and computer vision-based quality grading, while enterprise-grade ONIX Docker containers handle cryptographic network security and strictly validated peer-to-peer transaction routing.

---

## 🚀 Key Features

* **Zero-Friction Ingestion:** Farmers simply send a WhatsApp voice note (in English, Hindi, or Hinglish) and a photo of their crop. No dashboards, no apps to download.
* **Multimodal AI Grading:** Integrates Gemini 1.5 Flash to automatically extract product details, normalize units, and assign visual quality grades (e.g., "Grade A (Premium)") based on the crop image.
* **Real-time Beckn Broadcast:** Instantly syncs the WhatsApp-generated inventory to `catalog.json` and multicasts it to the open network via the `/beckn-webhook/discover` endpoint.
* **Strict Beckn v2.0.0 Compliance:** Fully implements the modern `contract` object schema (replacing legacy `order` schemas), strict camelCase descriptors, and nested metadata `tags`.
* **Interactive BAP Simulator (UI):** Includes a bespoke vintage-themed frontend that acts as a Mock Buyer App (BAP). It allows evaluators to visually step through the entire protocol handshake (`discover`, `select`, `init`, `confirm`) while inspecting live JSON payloads and network traces in real-time.

---

## 🏗️ System Architecture & Data Flow

The system separates business logic (Node.js) from protocol security (Go-based ONIX adapters).

```text
[ Farmer WhatsApp ] ──(Voice/Image)──► [ Meta Cloud API ] ──(Webhook)──► [ Ngrok Tunnel ]
                                                                                │
                                                                                ▼
[ Buyer App (UI) ]                                                     [ Node.js Backend ]
       │ (1. discover)                                                          │
       ▼                                                                        ▼
[ Caddy Router ] ◄──(Network Routing)──┐                              (Gemini AI Processing &
    (Port 9000)                        │                              catalog.json persistence)
       │                               │                                        │
       ▼                               │                                        ▼
[ ONIX BAP Adapter ]            [ ONIX BPP Adapter ] ◄──(Local POST)── [ Beckn Webhooks ]
    (Port 8081)                     (Port 8082)                         (discover, select,
       │                               │                                 init, confirm)
       └──────( Cryptographic Ed25519 Signing & Strict Schema Validation )──────┘
                                       │
                                 [ Redis Cache ]

```

---

## 📁 Directory Structure

```text
pedkhata/
├── server.js               # Main Express server & Webhook receiver
├── aiParser.js             # Gemini 1.5 Flash prompts for text, voice, and image
├── becknCatalog.js         # Logic to map AI output to Beckn v2.0.0 schemas
├── catalog.json            # Live state database of WhatsApp inventory
├── docker-compose.yml      # Caddy, Redis, and ONIX BAP/BPP containers
├── public/
│   └── index.html          # Interactive Vintage UI & Wire Trace Inspector
├── .env                    # Environment variables (API keys, Tokens)
└── package.json            # Node dependencies

```

---

## ⚙️ Prerequisites

1. **Node.js** (v18 or higher)
2. **Docker & Docker Compose** (For running the Beckn ONIX adapters)
3. **Ngrok** (For tunneling Meta webhooks to localhost)
4. **Meta Developer Account** (With a configured WhatsApp Business test app)
5. **Google Gemini API Key** (For AI parsing)

---

## 🛠️ Installation & Setup

### 1. Environment Configuration

Create a `.env` file in the root directory and populate it:

```env
PORT=8000
VERIFY_TOKEN=your_custom_secure_string
WHATSAPP_TOKEN=your_meta_temporary_access_token
PHONE_NUMBER_ID=your_meta_phone_number_id
GEMINI_API_KEY=your_google_gemini_api_key

```

*(Note: Meta temporary tokens expire every 24 hours. Ensure you refresh this before testing.)*

### 2. Start the Protocol Infrastructure (Docker)

Boot up the enterprise middleware (Adapters, Redis, and Gateway):

```bash
docker compose up -d

```

Verify containers are healthy on ports `8081`, `8082`, `9000`, and `6379`.

### 3. Start the Application Server

Install dependencies and run the Node.js webhook server:

```bash
npm install
node server.js

```

### 4. Expose Webhook to the Internet

In a new terminal, run Ngrok to expose port `8000`:

```bash
ngrok http 8000

```

*Copy the HTTPS URL generated by Ngrok and paste it into your Meta App Dashboard under WhatsApp -> Configuration -> Webhook URL.*

---

## 🎮 How to Use the Interactive Demo

1. **Send a WhatsApp Message:** From your registered test phone number, send a voice note to the bot: *"I want to list 50 kg of Alphonso Mangoes at 40 rupees per kg from Pune."*
2. **Send an Image:** The bot will reply asking for a photo. Send a picture of mangoes. The AI will instantly grade it and add it to the live network catalog.
3. **Open the UI:** Navigate to `http://localhost:8000` in your browser.
4. **Run the Protocol Flow:**
* **Discover:** Click "Broadcast Discover". The UI will load the newly ingested WhatsApp items.
* **Select:** Click an item to generate a dynamic quote (`on_select`).
* **Init:** Fill out delivery details and initialize fulfillment (`on_init`).
* **Confirm:** Authorize the legally structured Beckn contract (`on_confirm`).


5. **Inspect the Trace:** As you click through, watch the right-side **Beckn Wire Trace Terminal** to view the exact, strict v2.0.0 JSON payloads being transferred.

---

## ⚠️ Troubleshooting & Common Gotchas

* **`401 Unauthorized` on Voice Notes:** If AI audio parsing fails with a `401`, your Meta `WHATSAPP_TOKEN` has expired. Generate a new one, update `.env`, and **restart the Node server**.
* **`SCH_FIELD_NOT_ALLOWED` Error:** The ONIX adapters strictly enforce Beckn v2.0.0. If you accidentally send legacy v1.x fields (like `order` instead of `contract` during init/confirm), the BPP adapter will instantly reject the payload. Ensure `server.js` and frontend JavaScript payloads strictly align with the `contract` object structure.
* **Empty UI Catalog:** If items don't appear after sending a WhatsApp listing, ensure your `.env` keys are correct and perform a Hard Refresh (`Ctrl + Shift + R`) on the browser to clear UI caching.

---

## 🔮 Future Roadmap

* **Automated Dispatch Routing:** Upon receiving an `on_confirm` network callback, automate a WhatsApp push message back to the farmer with a pickup OTP.
* **Unbundled Logistics Integration:** Allow the BPP to query decentralized logistics providers (Riders/Trucks) via the Gateway to fulfill the order.
* **Reconciliation and Settlement (RSP):** Integrate automated UPI payouts upon verified proof-of-delivery (POD) scanning.

---

*Built for the decentralized web. Powered by Beckn & AI.*

