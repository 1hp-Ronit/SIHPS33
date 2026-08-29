const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

// Consolidated local imports

const { addOrUpdateProduce, getBecknCatalog } = require('./becknCatalog');
const { parseFarmerMessage, parseFarmerAudio, gradeCropImage } = require('./aiParser');

const pendingListings = {};

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;


// WhatsApp Message Sender
async function sendWhatsAppMessage(to, messageText) {
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: messageText }
            }
        });
        console.log(`✅ WhatsApp reply sent to ${to}`);
    } catch (error) {
        console.error('❌ Error sending WhatsApp message:', error.response ? error.response.data : error.message);
    }
}

// 1. WhatsApp Webhook Verification Endpoint
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// 2. WhatsApp Inbound Messages Endpoint
// 2. WhatsApp Inbound Messages Endpoint
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
        
        // ✅ ABSOLUTE TOP: Tell Meta "We got it!" immediately to stop duplicate webhooks
        res.sendStatus(200);

        const changes = body.entry?.[0]?.changes?.[0]?.value;

        if (changes?.messages) {
            const message = changes.messages[0];
            const from = message.from;
            const type = message.type; 

            if (type === 'text') {
                const text = message.text?.body;
                if (text) {
                    const lowerText = text.toLowerCase().trim();
                    const greetings = ['hi', 'hii', 'hello', 'hey', 'namaste', 'ram ram', 'kem cho'];
                    
                    if (greetings.includes(lowerText)) {
                        const welcomeMsg = `🌾 *Welcome to PedKhata Open Market!* 🚜\n\nTo list your crops, just send a text or 🎙️ *voice note* with:\n📦 *Crop Name*\n⚖️ *Quantity*\n💰 *Price*\n📍 *Location*`;
                        await sendWhatsAppMessage(from, welcomeMsg);
                        return; // Done
                    }

                    console.log(`\n📩 Farmer [${from}] Text: "${text}"`);
                    const parsedData = await parseFarmerMessage(text);
                    
                    if (parsedData.is_listing) {
                        pendingListings[from] = parsedData;
                        await sendWhatsAppMessage(from, `🌾 Got it! You want to list ${parsedData.quantity} ${parsedData.unit} of ${parsedData.item_name} at ₹${parsedData.price_per_unit}.\n\n📸 *Please send a clear photo of the crop* so our AI can grade its quality for buyers!`);
                    }
                }
            } else if (type === 'audio') {
                console.log(`\n🎙️ Farmer [${from}] Voice Note! Downloading...`);
                const mediaId = message.audio.id;
                try {
                    const mediaUrlRes = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, { headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` } });
                    const audioDataRes = await axios.get(mediaUrlRes.data.url, { headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }, responseType: 'arraybuffer' });
                    const base64Audio = Buffer.from(audioDataRes.data, 'binary').toString('base64');
                    
                    const parsedData = await parseFarmerAudio(base64Audio, message.audio.mime_type);
                    
                    if (parsedData.is_listing) {
                        pendingListings[from] = parsedData;
                        await sendWhatsAppMessage(from, `🌾 Voice note received! You are listing ${parsedData.quantity} ${parsedData.unit} of ${parsedData.item_name} at ₹${parsedData.price_per_unit}.\n\n📸 *Please send a clear photo of the crop* to complete the listing.`);
                    }
                } catch (error) {
                    console.error('❌ Audio Error:', error.message);
                }
            } else if (type === 'image') {
                
                // ✅ SAFETY CHECK: If memory is empty (or cleared by a duplicate thread), ignore this!
                if (!pendingListings[from]) {
                    // Only warn if this isn't a duplicate webhook spam
                    console.log(`⚠️ Ignored image from [${from}] - no pending listing found in memory.`);
                    return; 
                }

                // Lock the memory by pulling the data out and deleting it immediately
                // This guarantees a duplicate webhook thread can't process the same image!
                const pendingData = { ...pendingListings[from] };
                delete pendingListings[from];

                console.log(`\n📸 Farmer [${from}] sent an Image! Analyzing quality...`);
                const mediaId = message.image.id;
                try {
                    const mediaUrlRes = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, { headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` } });
                    const imgDataRes = await axios.get(mediaUrlRes.data.url, { headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }, responseType: 'arraybuffer' });
                    const base64Image = Buffer.from(imgDataRes.data, 'binary').toString('base64');
                    
                    const gradeData = await gradeCropImage(base64Image, message.image.mime_type);
                    console.log('🤖 AI Grade:', gradeData);

                    const imageUrl = `data:${message.image.mime_type};base64,${base64Image}`;
                    const finalData = { ...pendingData, ...gradeData, image_data_uri: imageUrl };

                    const savedItem = addOrUpdateProduce(from, finalData);

                    const confirmationMsg = `✅ *Listing Published with AI Certification!*\n\n` +
                        `• *Item:* ${finalData.item_name}\n` +
                        `• *AI Grade:* ${finalData.quality_grade}\n` +
                        `• *Inspector Notes:* ${finalData.visual_notes}\n\n` +
                        `Buyers can now see your verified listing! 🛒`;

                    await sendWhatsAppMessage(from, confirmationMsg);

                } catch (error) {
                    console.error('❌ Image Error:', error.message);
                }
            }
        }
  
    } else {
        res.sendStatus(404);
    }
});

// 3. Beckn Protocol /search endpoint (For Buyer Apps / Gateway querying the catalog)
app.post('/search', (req, res) => {
    console.log('🔍 Received Beckn /search request from Network');
    const catalogData = getBecknCatalog();

    // Construct standard Beckn on_search response payload
    const responsePayload = {
        context: {
            domain: "nic2004:52110",
            action: "on_search",
            version: "1.1.0",
            bpp_id: "pedkhata-bpp-node.ngrok-free.dev",
            bpp_uri: "https://pedkhata-bpp-node.ngrok-free.dev",
            timestamp: new Date().toISOString()
        },
        message: {
            catalog: {
                "bpp/descriptor": {
                    name: "PedKhata Farmer BPP"
                },
                "bpp/providers": [
                    {
                        id: catalogData.provider.id,
                        descriptor: catalogData.provider.descriptor,
                        items: catalogData.provider.items
                    }
                ]
            }
        }
    };

    res.status(200).json(responsePayload);
});

// Catalog view for quick debugging and our Buyer App Webpage
app.get('/catalog', (req, res) => {
    res.json(getBecknCatalog());
});

app.listen(PORT, () => {
    console.log(`🚀 Farmer Webhook & BPP Server listening on port ${PORT}`);
});