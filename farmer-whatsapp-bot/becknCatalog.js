const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, 'catalog.json');

/**
 * Adds or updates an item in the Beckn Provider Catalog (Strict v2.0.0 Format)
 */
function addOrUpdateProduce(farmerPhone, parsedData) {
    let catalog = { provider: { id: "pedkhata-farmer-provider-1", descriptor: { name: "PedKhata Direct Farmer Network" }, items: [] } };

    if (fs.existsSync(CATALOG_PATH)) {
        try {
            catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
        } catch (e) {
            console.error('Error reading catalog file, creating fresh one:', e);
        }
    }

    const itemId = `ITEM_${parsedData.item_name.toUpperCase().replace(/\s+/g, '_')}_${farmerPhone.slice(-4)}`;

    const newItem = {
        id: itemId,
        descriptor: {
            name: parsedData.item_name,
            code: parsedData.item_name.toLowerCase(),
            shortDesc: `Fresh ${parsedData.item_name} direct from farmer`,
            longDesc: `Available quantity: ${parsedData.quantity || 'Bulk'} ${parsedData.unit || 'units'}. Location: ${parsedData.location || 'Local farm'}.`
        },
        price: {
            currency: parsedData.currency || "INR",
            value: String(parsedData.price_per_unit)
        },
        tags: [
            {
                descriptor: {
                    code: "farmer_contact"
                },
                list: [
                    { descriptor: { code: "phone" }, value: farmerPhone },
                    { descriptor: { code: "location" }, value: parsedData.location || "Maharashtra" }
                ]
            },
            {
                descriptor: {
                    code: "quality_assessment"
                },
                list: [
                    { descriptor: { code: "grade" }, value: parsedData.quality_grade || "Pending" },
                    { descriptor: { code: "notes" }, value: parsedData.visual_notes || "No notes available." }
                ]
            }
        ]
    };

    // Ensure items array exists
    if (!catalog.provider.items) {
        catalog.provider.items = [];
    }

    // Update if item already exists for this farmer, otherwise append
    const existingIndex = catalog.provider.items.findIndex(i => i.id === itemId);
    if (existingIndex > -1) {
        catalog.provider.items[existingIndex] = newItem;
    } else {
        catalog.provider.items.push(newItem);
    }

    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
    console.log(`📦 Catalog updated: Saved ${parsedData.item_name} (ID: ${itemId})`);
    return newItem;
}

/**
 * Returns the Beckn catalog payload
 */
function getBecknCatalog() {
    if (fs.existsSync(CATALOG_PATH)) {
        return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    }
    return { provider: { items: [] } };
}

module.exports = { addOrUpdateProduce, getBecknCatalog };