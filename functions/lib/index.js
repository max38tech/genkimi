"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rakutenSearch = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
admin.initializeApp();
function extractIngredients(caption) {
    if (!caption)
        return "";
    const startPatterns = [
        /[■【]?原材料名?[】]?\s*[：:／\/]?\s*/,
    ];
    let ingredientsStart = -1;
    let matchLength = 0;
    for (const pattern of startPatterns) {
        const match = caption.match(pattern);
        if (match && match.index !== undefined) {
            ingredientsStart = match.index + match[0].length;
            matchLength = match[0].length;
            break;
        }
    }
    if (ingredientsStart === -1)
        return "";
    const afterMarker = caption.substring(ingredientsStart);
    const endPatterns = [
        /\s*[■【]/,
        /\s*栄養成分/,
        /\s*内容[量カ]/,
        /\s*容\s*量/,
        /\s*保存方法/,
        /\s*賞味期[限間]/,
        /\s*販売者/,
        /\s*製造者/,
        /\s*名称\s/,
        /\s*備考/,
        /\s*アレルギー/,
        /\s*(?:※|【)/,
        /\s*JANコード/,
        /\s*タイプ/,
        /\s*種類別/,
        /\s*カロリー/,
        /\s*希望小売/,
        /\s*商品説明/,
    ];
    let endIndex = afterMarker.length;
    for (const pattern of endPatterns) {
        const match = afterMarker.match(pattern);
        if (match && match.index !== undefined && match.index < endIndex) {
            endIndex = match.index;
        }
    }
    let ingredientsText = afterMarker.substring(0, endIndex).trim();
    ingredientsText = ingredientsText.replace(/^[、,\s●◆◇▲△▼▽★☆・]+|[、,\s●◆◇▲△▼▽★☆・]+$/g, "");
    logger.info(`[Ingredients Extracted] "${ingredientsText}"`);
    return ingredientsText;
}
exports.rakutenSearch = (0, https_1.onCall)({
    cors: true,
    region: "us-central1",
    invoker: "public"
}, async (request) => {
    var _a, _b;
    logger.info(">>> Rakuten Search Function Triggered <<<");
    logger.info("Data received:", request.data);
    const barcode = request.data.barcode;
    if (!barcode) {
        throw new https_1.HttpsError("invalid-argument", "The function must be called with a 'barcode' argument.");
    }
    const appId = process.env.RAKUTEN_APP_ID;
    const accessKey = process.env.RAKUTEN_ACCESS_KEY;
    if (!appId || !accessKey) {
        logger.error("Rakuten credentials missing in environment variables.");
        throw new https_1.HttpsError("failed-precondition", "Backend configuration missing: Rakuten App ID or Access Key.");
    }
    try {
        const url = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401";
        logger.info(`[Rakuten Business API] Searching: ${barcode}`);
        const response = await axios_1.default.get(url, {
            params: {
                applicationId: appId,
                accessKey: accessKey,
                keyword: barcode,
                format: "json",
                hits: 10
            },
            headers: {
                "Origin": "https://us-central1-genkimi-app.cloudfunctions.net",
                "Referer": "https://us-central1-genkimi-app.cloudfunctions.net/"
            }
        });
        const items = response.data.Items || [];
        let finalItem = null;
        for (const itemWrapper of items) {
            const item = itemWrapper.Item;
            const hasImage = item.mediumImageUrls && item.mediumImageUrls.length > 0;
            const caption = item.itemCaption || "";
            const ingredients = extractIngredients(caption);
            if (hasImage && ingredients.length > 0) {
                finalItem = {
                    name: item.itemName,
                    imageUrl: item.mediumImageUrls[0].imageUrl,
                    ingredients: ingredients,
                };
                break;
            }
        }
        if (!finalItem) {
            for (const itemWrapper of items) {
                const item = itemWrapper.Item;
                const hasImage = item.mediumImageUrls && item.mediumImageUrls.length > 0;
                if (hasImage) {
                    finalItem = {
                        name: item.itemName,
                        imageUrl: ((_a = item.mediumImageUrls[0]) === null || _a === void 0 ? void 0 : _a.imageUrl) || "https://via.placeholder.com/400",
                        ingredients: extractIngredients(item.itemCaption || ""),
                    };
                    break;
                }
            }
        }
        if (!finalItem) {
            return { success: false, message: "No product found on Rakuten." };
        }
        return {
            success: true,
            data: finalItem
        };
    }
    catch (error) {
        logger.error("[Rakuten Error] Full Error:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
        throw new https_1.HttpsError("internal", `Rakuten API Failed: ${error.message}`);
    }
});
//# sourceMappingURL=index.js.map