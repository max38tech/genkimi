import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import axios from "axios";

admin.initializeApp();

/**
 * Extract only the ingredients section from a Rakuten itemCaption.
 * Japanese product listings embed ingredients between markers like 原材料 and
 * section boundaries like 栄養成分, 内容量, 保存方法, etc.
 */
function extractIngredients(caption: string): string {
  if (!caption) return "";

  // Find the start of the ingredients section
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

  if (ingredientsStart === -1) return "";

  // Extract text from after the marker
  const afterMarker = caption.substring(ingredientsStart);

  // Find the end of the ingredients section (next section boundary)
  const endPatterns = [
    /\s*[■【]/,                    // Next section marker ■ or 【
    /\s*栄養成分/,                  // Nutrition facts
    /\s*内容[量カ]/,                // Contents
    /\s*保存方法/,                  // Storage method
    /\s*賞味期[限間]/,              // Expiration
    /\s*販売者/,                    // Seller
    /\s*製造者/,                    // Manufacturer
    /\s*名称\s/,                    // Product name label
    /\s*備考/,                      // Notes
    /\s*アレルギー/,                // Allergy info (separate from ingredients)
    /\s*(?:※|【)/,                 // Disclaimers or bracket sections
    /\s*JANコード/,                // JAN code (if it appears after)
  ];

  let endIndex = afterMarker.length;
  for (const pattern of endPatterns) {
    const match = afterMarker.match(pattern);
    if (match && match.index !== undefined && match.index < endIndex) {
      endIndex = match.index;
    }
  }

  let ingredientsText = afterMarker.substring(0, endIndex).trim();

  // Clean up: remove trailing/leading punctuation and whitespace
  ingredientsText = ingredientsText.replace(/^[、,\s]+|[、,\s]+$/g, "");

  logger.info(`[Ingredients Extracted] "${ingredientsText}"`);
  return ingredientsText;
}

/**
 * Rakuten Ichiba Item Search - Cloud Function
 * Moves the API call to the backend to protect the Application ID and inject Referer header.
 */
export const rakutenSearch = onCall({ 
  cors: true,
  region: "us-central1",
  invoker: "public"
}, async (request) => {
  logger.info(">>> Rakuten Search Function Triggered <<<");
  logger.info("Data received:", request.data);

  const barcode = request.data.barcode;
  
  if (!barcode) {
    throw new HttpsError(
      "invalid-argument", 
      "The function must be called with a 'barcode' argument."
    );
  }

  const appId = process.env.RAKUTEN_APP_ID;
  const accessKey = process.env.RAKUTEN_ACCESS_KEY;
  
  if (!appId || !accessKey) {
    logger.error("Rakuten credentials missing in environment variables.");
    throw new HttpsError(
      "failed-precondition", 
      "Backend configuration missing: Rakuten App ID or Access Key."
    );
  }

  try {
    const url = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401";
    
    logger.info(`[Rakuten Business API] Searching: ${barcode}`);

    const response = await axios.get(url, {
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

    // Iterate to find the first item with image and extractable ingredients
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

    // Fallback: try any item with an image
    if (!finalItem) {
      for (const itemWrapper of items) {
        const item = itemWrapper.Item;
        const hasImage = item.mediumImageUrls && item.mediumImageUrls.length > 0;
        if (hasImage) {
          finalItem = {
            name: item.itemName,
            imageUrl: item.mediumImageUrls[0]?.imageUrl || "https://via.placeholder.com/400",
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

  } catch (error: any) {
    logger.error("[Rakuten Error] Full Error:", error.response?.data || error.message);
    throw new HttpsError(
      "internal",
      `Rakuten API Failed: ${error.message}`
    );
  }
});
