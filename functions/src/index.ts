import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";

admin.initializeApp();

/**
 * Rakuten Ichiba Item Search - Cloud Function
 * Moves the API call to the backend to protect the Application ID and inject Referer header.
 */
export const rakutenSearch = onCall(async (request) => {
  const barcode = request.data.barcode;
  
  if (!barcode) {
    throw new HttpsError(
      "invalid-argument", 
      "The function must be called with a 'barcode' argument."
    );
  }

  // The Rakuten Application ID should be set in the Firebase environment
  // e.g., firebase functions:secrets:set RAKUTEN_APP_ID=your_id
  const appId = process.env.RAKUTEN_APP_ID;
  
  if (!appId) {
    console.error("RAKUTEN_APP_ID is not set in environment variables.");
    throw new HttpsError(
      "failed-precondition", 
      "Backend configuration missing: Rakuten Application ID."
    );
  }

  try {
    const url = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601";
    
    // We fetch up to 10 items to find one with complete data
    const response = await axios.get(url, {
      params: {
        applicationId: appId,
        keyword: barcode,
        hits: 10,
        format: "json",
      },
      headers: {
        "Referer": "https://genkimi.app"
      }
    });

    const items = response.data.Items || [];
    let finalItem = null;

    // Logic: Iterate to find the first item with both image and caption
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

    // Fallback if no perfect match found, but we have some items
    if (!finalItem && items.length > 0) {
      const firstItem = items[0].Item;
      finalItem = {
        name: firstItem.itemName,
        imageUrl: firstItem.mediumImageUrls?.[0]?.imageUrl || "https://via.placeholder.com/400",
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

  } catch (error: any) {
    console.error("Rakuten API Call Failed:", error.response?.data || error.message);
    throw new HttpsError(
      "internal",
      "An error occurred while fetching data from Rakuten Ichiba."
    );
  }
});
