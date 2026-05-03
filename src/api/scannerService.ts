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

    const getSafetyLevel = (name: string): 'safe' | 'caution' | 'warning' => {
      const n = name.toLowerCase();
      const warnings = ['sugar', 'syrup', 'sucrose', 'fructose', 'glucose', 'dextrose', 'maltodextrin', 'aspartame', 'sucralose', 'saccharin', 'acesulfame', 'artificial', 'color', 'dye', 'preservative', 'bht', 'bha', 'hydrogenated', 'msg', 'monosodium glutamate', 'nitrate', 'nitrite', 'アセスルファム', 'スクラロース', '砂糖', '果糖', 'ブドウ糖', '香料', '着色料', '保存料'];
      const safes = ['almond', 'peanut', 'walnut', 'pecan', 'cashew', 'macadamia', 'hazelnut', 'nut', 'seed', 'chia', 'flax', 'hemp', 'oat', 'whole wheat', 'brown rice', 'quinoa', 'vegetable', 'fruit', 'berry', 'apple', 'orange', 'banana', 'アーモンド', 'ピーナッツ', 'くるみ', 'ナッツ', 'オーツ麦', '全粒粉', '玄米', '野菜', '果物'];
      
      if (warnings.some(w => n.includes(w))) return 'warning';
      if (safes.some(s => n.includes(s))) return 'safe';
      return 'caution';
    };

    if (rakutenProduct) {
      // If we have Rakuten data, let's try to use it primarily for testing
      let ingredientsList: Ingredient[] = [];
      if (rakutenProduct.ingredients) {
        // Simple split for now to see what we get
        ingredientsList = rakutenProduct.ingredients.split(/[、,。\n]/).map((text: string, index: number) => {
          const name = text.trim();
          return {
            id: `rakuten-${index}`,
            name: name,
            safety: getSafetyLevel(name)
          };
        }).filter((i: any) => i.name.length > 1 && i.name.length < 50);
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
      // Extract best category first so we can use it for heuristic scoring
      const categoryStr = offProduct.categories || offProduct.categories_tags?.join(', ') || baseInfo.category || 'Unknown Category';
      const mainCategory = categoryStr.split(',')[0].replace(/en:/g, '').replace(/ja:/g, '').replace(/-/g, ' ').trim();
      const mainCategoryFormatted = mainCategory.charAt(0).toUpperCase() + mainCategory.slice(1);

      // Calculate a more accurate score based on nutriscore, nova group, or ecoscore
      let calculatedScore = 50;
      let hasRealScore = false;
      
      if (offProduct.nutriscore_score !== undefined) {
        // Nutriscore is -15 (best) to 40 (worst). 
        // We want 40 to be around 10-15/100 instead of 0, and -15 to be 100/100.
        // Old math: 100 - ((score + 15) * 2)
        // New math: (40 - score) / 55 * 90 + 10 (so worst is 10, best is 100)
        calculatedScore = Math.max(0, Math.min(100, Math.round(((40 - offProduct.nutriscore_score) / 55) * 90 + 10)));
        hasRealScore = true;
      } else if (offProduct.nutriscore_grade) {
        const grades: Record<string, number> = { a: 95, b: 80, c: 55, d: 35, e: 15 };
        calculatedScore = grades[offProduct.nutriscore_grade.toLowerCase()] || 50;
        hasRealScore = true;
      } else if (offProduct.nova_group) {
         const novaScores: Record<number, number> = { 1: 85, 2: 65, 3: 45, 4: 25 };
         calculatedScore = novaScores[offProduct.nova_group] || 50;
         hasRealScore = true;
      } else if (offProduct.ecoscore_score) {
         calculatedScore = offProduct.ecoscore_score;
         hasRealScore = true;
      }

      // If no official score, apply category-based heuristics
      if (!hasRealScore) {
        const lowerCategory = categoryStr.toLowerCase();
        if (lowerCategory.includes('candy') || lowerCategory.includes('chocolate') || lowerCategory.includes('sweets') || lowerCategory.includes('dessert') || lowerCategory.includes('confectioneries')) {
          calculatedScore = 25; // Default penalty for sweets
        } else if (lowerCategory.includes('snack') || lowerCategory.includes('chips')) {
          calculatedScore = 40; // Default penalty for snacks
        } else if (lowerCategory.includes('vegetable') || lowerCategory.includes('fruit') || lowerCategory.includes('nuts')) {
          calculatedScore = 80; // Default boost for healthy categories
        }
      }

      // Parse actual ingredients
      let ingredientsList: Ingredient[] = [];
      const getSafetyLevel = (name: string): 'safe' | 'caution' | 'warning' => {
        const n = name.toLowerCase();
        const warnings = ['sugar', 'syrup', 'sucrose', 'fructose', 'glucose', 'dextrose', 'maltodextrin', 'aspartame', 'sucralose', 'saccharin', 'acesulfame', 'artificial', 'color', 'dye', 'preservative', 'bht', 'bha', 'hydrogenated', 'msg', 'monosodium glutamate', 'nitrate', 'nitrite', 'アセスルファム', 'スクラロース', '砂糖', '果糖', 'ブドウ糖', '香料', '着色料', '保存料'];
        const safes = ['almond', 'peanut', 'walnut', 'pecan', 'cashew', 'macadamia', 'hazelnut', 'nut', 'seed', 'chia', 'flax', 'hemp', 'oat', 'whole wheat', 'brown rice', 'quinoa', 'vegetable', 'fruit', 'berry', 'apple', 'orange', 'banana', 'アーモンド', 'ピーナッツ', 'くるみ', 'ナッツ', 'オーツ麦', '全粒粉', '玄米', '野菜', '果物'];
        
        if (warnings.some(w => n.includes(w))) return 'warning';
        if (safes.some(s => n.includes(s))) return 'safe';
        return 'caution';
      };

      if (offProduct.ingredients && offProduct.ingredients.length > 0) {
        ingredientsList = offProduct.ingredients.map((i: any, index: number) => {
          const name = i.text || i.id?.replace(/en:/g, '').replace(/ja:/g, '').replace(/-/g, ' ') || 'Unknown Ingredient';
          return {
            id: index.toString(),
            name: name,
            safety: getSafetyLevel(name)
          };
        });
      } else if (offProduct.ingredients_tags && offProduct.ingredients_tags.length > 0) {
        ingredientsList = offProduct.ingredients_tags.map((tag: string, index: number) => {
           const name = tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').replace(/_/g, ' ');
           return {
             id: index.toString(),
             name: name,
             safety: getSafetyLevel(name)
           };
        }).filter((i: any) => i.name.length > 0);
      } else {
        const ingredientsText = offProduct.ingredients_text_en || offProduct.ingredients_text_ja || offProduct.ingredients_text || '';
        if (ingredientsText) {
           ingredientsList = ingredientsText.split(/[,、]/).map((text: string, index: number) => {
             const name = text.trim().replace(/^\*+|\*+$/g, '');
             return {
               id: index.toString(),
               name: name,
               safety: getSafetyLevel(name)
             };
           }).filter((i: any) => i.name.length > 0);
        }
      }

      // Clean up capitalization
      ingredientsList = ingredientsList.map(i => ({
        ...i,
        name: i.name ? i.name.charAt(0).toUpperCase() + i.name.slice(1) : 'Unknown'
      }));

      // Heuristic: If first ingredient is sugar/syrup and no official score, penalize further
      if (!hasRealScore && ingredientsList.length > 0) {
        if (ingredientsList[0].safety === 'warning' && (ingredientsList[0].name.toLowerCase().includes('sugar') || ingredientsList[0].name.toLowerCase().includes('syrup') || ingredientsList[0].name.includes('砂糖'))) {
          calculatedScore = Math.min(calculatedScore, 20);
        }
      }

      return {
        code: barcode,
        name: baseInfo.name,
        image: baseInfo.image,
        score: calculatedScore,
        category: mainCategoryFormatted,
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
