const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, 'catalog.json');

/**
 * Adds or updates an item in the Beckn Provider Catalog
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
            symbol: "🌾",
            short_desc: `Fresh ${parsedData.item_name} direct from farmer`,
            long_desc: `Available quantity: ${parsedData.quantity || 'Bulk'} ${parsedData.unit || 'units'}. Location: ${parsedData.location || 'Local farm'}.`,
            images: parsedData.image_data_uri ? [parsedData.image_data_uri] : []

        },
        price: {
            currency: parsedData.currency || "INR",
            value: String(parsedData.price_per_unit)
        },
        quantity: {
            available: {
                count: parsedData.quantity || 100
            },
            unitized: {
                measure: {
                    unit: parsedData.unit || "kg",
                    value: "1"
                }
            }
        },
        tags: [
            {
                code: "farmer_contact",
                list: [
                    { code: "phone", value: farmerPhone },
                    { code: "location", value: parsedData.location || "Maharashtra" }
                ]
            },
            {
                // NEW: Adding the quality grading tags
                code: "quality_assessment",
                list: [
                    { code: "grade", value: parsedData.quality_grade || "Pending" },
                    { code: "notes", value: parsedData.visual_notes || "No notes available." }
                ]
            }
        ],
        matched: true
    };

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
 * Returns the Beckn /on_search catalog payload
 */
function getBecknCatalog() {
    if (fs.existsSync(CATALOG_PATH)) {
        return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    }
    return { provider: { items: [] } };
}

module.exports = { addOrUpdateProduce, getBecknCatalog };