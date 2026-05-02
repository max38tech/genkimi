import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export interface ProductData {
  code: string;
  name: string;
  image: string;
  score: number | null;
  ingredients: Ingredient[];
  alternatives: Alternative[];
  category: string;
  isPartialData?: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  safety: 'safe' | 'caution' | 'warning';
  description?: string;
}

export interface Alternative {
  id: string;
  name: string;
  image: string;
  score: number;
}

// Fallback Japanese mock data
const mockJapaneseProduct: ProductData = {
  code: '4901330502881',
  name: 'Calbee Potato Chips Lightly Salted',
  category: 'Snacks',
  image: 'https://images.openfoodfacts.org/images/products/490/133/050/2881/front_ja.3.400.jpg',
  score: 45,
  ingredients: [
    { id: '1', name: 'Potatoes', safety: 'safe' },
    { id: '2', name: 'Vegetable Oil', safety: 'caution', description: 'High in calories and fat' },
    { id: '3', name: 'Salt', safety: 'caution', description: 'High sodium content' },
    { id: '4', name: 'Flavor Enhancer (Amino Acids)', safety: 'warning', description: 'Artificial additive' },
  ],
  alternatives: [
    {
      id: 'alt1',
      name: 'Baked Sweet Potato Chips',
      image: 'https://images.openfoodfacts.org/images/products/490/133/050/2881/front_ja.3.400.jpg', // mock image
      score: 85
    },
    {
      id: 'alt2',
      name: 'Organic Rice Crackers',
      image: 'https://images.openfoodfacts.org/images/products/490/133/050/2881/front_ja.3.400.jpg', // mock image
      score: 92
    }
  ]
};

// Helper to fetch from Yahoo Japan Shopping API
const fetchFromYahoo = async (barcode: string) => {
  const appId = process.env.EXPO_PUBLIC_YAHOO_CLIENT_ID;
  if (!appId) return null;
  try {
    const res = await fetch(`https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${appId}&jan_code=${barcode}&results=1`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.hits && data.hits.length > 0) {
      const item = data.hits[0];
      return {
        name: item.name,
        image: item.image.medium || item.image.small,
        category: item.genreCategory?.name || 'Unknown',
      };
    }
  } catch (e) {
    console.warn('Yahoo API error:', e);
  }
  return null;
};

// Helper to fetch from Rakuten Ichiba API via Cloud Function
const fetchFromRakuten = async (barcode: string) => {
  try {
    const rakutenSearch = httpsCallable(functions, 'rakutenSearch');
    const result = await rakutenSearch({ barcode });
    const responseData = result.data as any;

    if (responseData.success && responseData.data) {
      const item = responseData.data;
      return {
        name: item.name,
        image: item.imageUrl,
        ingredients: item.ingredients,
        category: 'Unknown',
      };
    }
  } catch (e) {
    console.warn('Rakuten Cloud Function error:', e);
  }
  return null;
};

const fetchFromOpenFoodFacts = async (barcode: string) => {
  const databases = [
    'https://world.openfoodfacts.org',
    'https://world.openbeautyfacts.org',
    'https://world.openproductsfacts.org'
  ];

  for (const db of databases) {
    try {
      const response = await fetch(`${db}/api/v2/product/${barcode}.json`);
      if (!response.ok) continue;
      const data = await response.json();
      
      if (data.status === 1 && data.product) {
        return data.product;
      }
    } catch (err) {
      console.warn(`Failed to query ${db}:`, err);
    }
  }
  return null;
};

export const fetchProductData = async (barcode: string): Promise<ProductData> => {
  try {
    // Return mock data only if specific mock barcode is scanned
    if (barcode === mockJapaneseProduct.code) {
      return mockJapaneseProduct;
    }

    // Fire all requests concurrently
    const [offResult, yahooResult, rakutenResult] = await Promise.allSettled([
      fetchFromOpenFoodFacts(barcode),
      fetchFromYahoo(barcode),
      fetchFromRakuten(barcode)
    ]);

    const offProduct = offResult.status === 'fulfilled' ? offResult.value : null;
    const yahooProduct = yahooResult.status === 'fulfilled' ? yahooResult.value : null;
    const rakutenProduct = rakutenResult.status === 'fulfilled' ? rakutenResult.value : null;

    // DEBUG: Log Rakuten results for testing
    console.log('--- Rakuten Test Data ---');
    console.log('Barcode:', barcode);
    if (rakutenProduct) {
      console.log('Name:', rakutenProduct.name);
      console.log('Has Ingredients:', !!rakutenProduct.ingredients);
      console.log('Caption Length:', rakutenProduct.ingredients?.length || 0);
      // console.log('Raw Caption:', rakutenProduct.ingredients); // Uncomment to see full text
    } else {
      console.log('Rakuten: No product found.');
    }
    console.log('-------------------------');

    // If we have nothing, throw error
    if (!offProduct && !yahooProduct && !rakutenProduct) {
      throw new Error('Product not found in any database');
    }

    // TEST MODE: Prioritize Rakuten -> Yahoo -> OFF
    const baseInfo = rakutenProduct || yahooProduct || {
      name: offProduct?.product_name_ja || offProduct?.product_name_en || offProduct?.product_name || 'Unknown Product',
      image: offProduct?.image_url || offProduct?.image_front_url || 'https://via.placeholder.com/400',
      category: 'Unknown'
    };

    if (rakutenProduct) {
      // If we have Rakuten data, let's try to use it primarily for testing
      let ingredientsList: Ingredient[] = [];
      if (rakutenProduct.ingredients) {
        // Simple split for now to see what we get
        ingredientsList = rakutenProduct.ingredients.split(/[、,。\n]/).map((text: string, index: number) => ({
          id: `rakuten-${index}`,
          name: text.trim(),
          safety: 'caution' as const
        })).filter((i: any) => i.name.length > 1 && i.name.length < 50);
      }

      return {
        code: barcode,
        name: rakutenProduct.name,
        image: rakutenProduct.image,
        score: offProduct ? 50 : null, // Still use OFF for score if available, otherwise null
        category: 'Rakuten Product',
        ingredients: ingredientsList,
        alternatives: [],
        isPartialData: !offProduct
      };
    }

    if (offProduct) {
      // Calculate a more accurate score based on nutriscore, nova group, or ecoscore
      let calculatedScore = 50;
      if (offProduct.nutriscore_score !== undefined) {
        calculatedScore = Math.max(0, Math.min(100, 100 - ((offProduct.nutriscore_score + 15) * 2)));
      } else if (offProduct.nutriscore_grade) {
        const grades: Record<string, number> = { a: 90, b: 75, c: 50, d: 25, e: 10 };
        calculatedScore = grades[offProduct.nutriscore_grade.toLowerCase()] || 50;
      } else if (offProduct.nova_group) {
         const novaScores: Record<number, number> = { 1: 80, 2: 60, 3: 40, 4: 20 };
         calculatedScore = novaScores[offProduct.nova_group] || 50;
      } else if (offProduct.ecoscore_score) {
         calculatedScore = offProduct.ecoscore_score;
      }

      // Parse actual ingredients
      let ingredientsList: Ingredient[] = [];
      if (offProduct.ingredients && offProduct.ingredients.length > 0) {
        ingredientsList = offProduct.ingredients.map((i: any, index: number) => ({
          id: index.toString(),
          name: i.text || i.id?.replace(/en:/g, '').replace(/ja:/g, '').replace(/-/g, ' ') || 'Unknown Ingredient',
          safety: (i.vegan === 'yes' || i.vegetarian === 'yes') ? 'safe' : (i.vegan === 'no' ? 'warning' : 'caution')
        }));
      } else if (offProduct.ingredients_tags && offProduct.ingredients_tags.length > 0) {
        ingredientsList = offProduct.ingredients_tags.map((tag: string, index: number) => ({
           id: index.toString(),
           name: tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').replace(/_/g, ' '),
           safety: 'caution' as const
        })).filter((i: any) => i.name.length > 0);
      } else {
        const ingredientsText = offProduct.ingredients_text_en || offProduct.ingredients_text_ja || offProduct.ingredients_text || '';
        if (ingredientsText) {
           ingredientsList = ingredientsText.split(/[,、]/).map((text: string, index: number) => ({
             id: index.toString(),
             name: text.trim().replace(/^\*+|\*+$/g, ''),
             safety: 'caution' as const
           })).filter((i: any) => i.name.length > 0);
        }
      }

      // Clean up capitalization
      ingredientsList = ingredientsList.map(i => ({
        ...i,
        name: i.name ? i.name.charAt(0).toUpperCase() + i.name.slice(1) : 'Unknown'
      }));

      // Extract best category
      const categoryStr = offProduct.categories || offProduct.categories_tags?.join(', ') || baseInfo.category || 'Unknown Category';
      const mainCategory = categoryStr.split(',')[0].replace(/en:/g, '').replace(/ja:/g, '').replace(/-/g, ' ').trim();

      return {
        code: barcode,
        name: baseInfo.name,
        image: baseInfo.image,
        score: calculatedScore,
        category: mainCategory.charAt(0).toUpperCase() + mainCategory.slice(1),
        ingredients: ingredientsList,
        alternatives: [],
        isPartialData: false
      };
    } else {
      // Partial Data State (e.g. only Yahoo results found)
      return {
        code: barcode,
        name: baseInfo.name,
        image: baseInfo.image,
        score: null,
        category: baseInfo.category || 'Unknown Category',
        ingredients: [], // No ingredients if we only have Yahoo
        alternatives: [],
        isPartialData: true
      };
    }
  } catch (error: any) {
    console.warn('ScannerService Error:', error.message || error);
    throw error;
  }
};
