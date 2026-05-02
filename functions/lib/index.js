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
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
admin.initializeApp();
exports.rakutenSearch = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c;
    const barcode = request.data.barcode;
    if (!barcode) {
        throw new https_1.HttpsError("invalid-argument", "The function must be called with a 'barcode' argument.");
    }
    const appId = process.env.RAKUTEN_APP_ID;
    const accessKey = process.env.RAKUTEN_ACCESS_KEY;
    if (!appId || !accessKey) {
        console.error("Rakuten credentials missing in environment variables.");
        throw new https_1.HttpsError("failed-precondition", "Backend configuration missing: Rakuten App ID or Access Key.");
    }
    try {
        const url = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401";
        console.log(`[Rakuten Business API] Searching: ${barcode}`);
        const response = await axios_1.default.get(url, {
            params: {
                applicationId: appId,
                accessKey: accessKey,
                keyword: barcode,
                format: "json",
                hits: 10
            }
        });
        const items = response.data.Items || [];
        let finalItem = null;
        for (const itemWrapper of items) {
            const item = itemWrapper.Item;
            const hasImage = item.mediumImageUrls && item.mediumImageUrls.length > 0;
            const hasCaption = item.itemCaption && item.itemCaption.trim().length > 0;
            if (hasImage && hasCaption) {
                finalItem = {
                    name: item.itemName,
                    imageUrl: item.mediumImageUrls[0].imageUrl,
                    ingredients: item.itemCaption,
                };
                break;
            }
        }
        if (!finalItem && items.length > 0) {
            const firstItem = items[0].Item;
            finalItem = {
                name: firstItem.itemName,
                imageUrl: ((_b = (_a = firstItem.mediumImageUrls) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.imageUrl) || "https://via.placeholder.com/400",
                ingredients: firstItem.itemCaption || "",
            };
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
        console.error("[Rakuten Error] Full Error:", ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) || error.message);
        throw new https_1.HttpsError("internal", `Rakuten API Failed: ${error.message}`);
    }
});
//# sourceMappingURL=index.js.map