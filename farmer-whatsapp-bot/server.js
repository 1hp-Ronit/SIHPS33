const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');

require('dotenv').config();

// Consolidated local imports
const { addOrUpdateProduce, getBecknCatalog } = require('./becknCatalog');
const { parseFarmerMessage, parseFarmerAudio, gradeCropImage } = require('./aiParser');

const pendingListings = {};

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
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
                        return;
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
                if (!pendingListings[from]) {
                    console.log(`⚠️ Ignored image from [${from}] - no pending listing found in memory.`);
                    return; 
                }

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

// 3. Beckn Protocol Webhook for Discovery
app.post('/beckn-webhook/discover', async (req, res) => {
    // 1. Instantly acknowledge the request to prevent timeouts
    res.status(200).send({
        message: {
            ack: { status: "ACK" }
        }
    });

    console.log("\n🔍 Received discover request. Loading dynamic WhatsApp catalog...");

    try {
        const catalogData = getBecknCatalog();

        // 2. Construct the strict Beckn v2.0.0 on_discover payload
        const onDiscoverPayload = {
            context: {
                ...req.body.context,
                action: 'on_discover',
                timestamp: new Date().toISOString()
            },
            message: {
                catalogs: [
                    {
                        "id": "pedkhata-live-catalog",
                        "descriptor": {
                            "name": "PedKhata WhatsApp Market"
                        },
                        "provider": {
                            "id": catalogData.provider.id,
                            "descriptor": catalogData.provider.descriptor
                        },
                        "offers": catalogData.provider.items
                    }
                ]
            }
        };

        // 3. Send the async callback to your Provider Adapter
        const response = await axios.post('http://localhost:8082/bpp/caller/on_discover', onDiscoverPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status === 200) {
            console.log("✅ Successfully broadcasted WhatsApp catalog to the network!");
        }

    } catch (error) {
        console.error("❌ Error processing discover:");
        console.error(error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
});

// 4. Beckn Protocol Webhook for Select (Generating the Quote)
app.post('/beckn-webhook/select', async (req, res) => {
    res.status(200).send({
        message: {
            ack: { status: "ACK" }
        }
    });

    console.log("\n🛒 Received select request. Generating quote...");

    try {
        const onSelectPayload = {
            context: {
                ...req.body.context,
                action: 'on_select',
                timestamp: new Date().toISOString()
            },
            message: req.body.message
        };

        const response = await axios.post('http://localhost:8082/bpp/caller/on_select', onSelectPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status === 200) {
            console.log("✅ Successfully sent on_select quote back to the network!");
        }
    } catch (error) {
        console.error("❌ Error processing select:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
});

// 5. Beckn Protocol Webhook for Init (Checkout / Fulfillment)
app.post('/beckn-webhook/init', async (req, res) => {
    res.status(200).send({
        message: { ack: { status: "ACK" } }
    });

    console.log("\n📦 Received init (checkout) request. Processing fulfillment...");

    try {
        const onInitPayload = {
            context: {
                ...req.body.context,
                action: 'on_init',
                timestamp: new Date().toISOString()
            },
            message: req.body.message
        };

        const response = await axios.post('http://localhost:8082/bpp/caller/on_init', onInitPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status === 200) {
            console.log("✅ Successfully sent on_init response!");
        }
    } catch (error) {
        console.error("❌ Error processing init:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
});

// 6. Beckn Protocol Webhook for Confirm (Order Placement)
// 6. Beckn Protocol Webhook for Confirm (Order Placement)
app.post('/beckn-webhook/confirm', async (req, res) => {
    // 1. Instantly ACK the request
    res.status(200).send({
        message: { ack: { status: "ACK" } }
    });

    console.log("\n🎉 Received confirm request! Finalizing order...");

    try {
        const contract = req.body.message.contract;
        
        // 2. Extract details from the v2.0.0 strict contract payload
        const itemName = contract.commitments[0]?.descriptor?.name || "Produce";
        const totalAmount = contract.consideration[0]?.price?.value || "0";
        
        const buyerParticipant = contract.participants.find(p => p.descriptor.code === 'buyer');
        const buyerName = buyerParticipant?.descriptor?.name || "A verified buyer";

        // 3. Prepare the outbound Beckn callback
        const onConfirmPayload = {
            context: {
                ...req.body.context,
                action: 'on_confirm',
                timestamp: new Date().toISOString()
            },
            message: req.body.message
        };

        // 4. Send the callback to the ONIX network adapter
        const response = await axios.post('http://localhost:8082/bpp/caller/on_confirm', onConfirmPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status === 200) {
            console.log("✅ Successfully confirmed order on the network!");
            
            // 5. 🚀 THE NEW FEATURE: Notify the Farmer via WhatsApp!
            const catalogData = getBecknCatalog();
            const item = catalogData.provider.items.find(i => i.descriptor.name === itemName);
            
            let farmerPhone = null;
            if (item) {
                // Dig into the tags array to find the farmer's phone number we saved earlier
                const contactTag = item.tags.find(t => t.descriptor.code === 'farmer_contact');
                const phoneObj = contactTag?.list.find(l => l.descriptor.code === 'phone');
                if (phoneObj) farmerPhone = phoneObj.value;
            }

            if (farmerPhone) {
                const notifyMsg = `🎉 *Great news! Your crop has been sold on PedKhata!*\n\n` +
                                  `🛒 *Buyer:* ${buyerName}\n` +
                                  `🌾 *Item Sold:* ${itemName}\n` +
                                  `💰 *Total Amount:* ₹${totalAmount}\n\n` +
                                  `🚚 A delivery partner will arrive soon for pickup. Please keep the produce ready!`;
                
                await sendWhatsAppMessage(farmerPhone, notifyMsg);
                console.log(`📲 WhatsApp confirmation successfully dispatched to farmer at ${farmerPhone}`);
            } else {
                console.log("⚠️ Order confirmed, but couldn't find farmer's phone number in catalog.");
            }
        }
    } catch (error) {
        console.error("❌ Error processing confirm:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
});
// Catalog view for quick debugging and our Buyer App Webpage
app.get('/catalog', (req, res) => {
    res.json(getBecknCatalog());
});

app.listen(PORT, '0.0.0.0',() => {
    console.log(`🚀 Farmer Webhook & BPP Server listening on port ${PORT}`);
});

