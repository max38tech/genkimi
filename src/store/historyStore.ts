import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProductData } from '../api/scannerService';

const HISTORY_KEY = '@genkimi_history';

export interface HistoryItem extends ProductData {
  scannedAt: number;
}

export const getHistory = async (): Promise<HistoryItem[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(HISTORY_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error('Failed to fetch history', e);
    return [];
  }
};

export const saveToHistory = async (product: ProductData): Promise<void> => {
  try {
    const currentHistory = await getHistory();
    // Remove if already exists so we can move it to the top
    const filteredHistory = currentHistory.filter(item => item.code !== product.code);
    
    const newItem: HistoryItem = {
      ...product,
      scannedAt: Date.now(),
    };
    
    const newHistory = [newItem, ...filteredHistory];
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  } catch (e) {
    console.error('Failed to save to history', e);
  }
};

export const clearHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.error('Failed to clear history', e);
  }
};
