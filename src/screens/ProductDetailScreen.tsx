import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Image, ScrollView, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { fetchProductData, ProductData } from '../api/scannerService';
import { saveToHistory } from '../store/historyStore';
import { ScoreBadge, getScoreLabel, getScoreColor } from '../components/ScoreBadge';
import { IngredientItem } from '../components/IngredientItem';
import { colors, spacing, typography } from '../theme/colors';

export const ProductDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { barcode } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ProductData | null>(null);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const data = await fetchProductData(barcode);
        setProduct(data);
        await saveToHistory(data);
      } catch (error) {
        console.warn('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [barcode]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Analyzing product...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Product not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.goBack()}>
          <ArrowLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analysis</Text>
        <View style={styles.headerIcon} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Product Header */}
        <View style={styles.productHeader}>
          <Image source={{ uri: product.image }} style={styles.productImage} resizeMode="contain" />
          <View style={styles.productInfo}>
            <Text style={styles.category}>{product.category}</Text>
            <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
            <View style={styles.scoreContainer}>
               <ScoreBadge score={product.score} size="large" />
               <View style={styles.scoreLabelContainer}>
                 <Text style={[styles.scoreLabelText, { color: getScoreColor(product.score) }]}>
                   {getScoreLabel(product.score)}
                 </Text>
               </View>
            </View>
          </View>
        </View>

        {/* Ingredients Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {product.ingredients && product.ingredients.length > 0 ? (
            product.ingredients.map(ingredient => (
              <IngredientItem key={ingredient.id} ingredient={ingredient} />
            ))
          ) : (
            <Text style={styles.emptyText}>No ingredient data available.</Text>
          )}
        </View>

        {/* Upsell Section for Partial Data */}
        {product.isPartialData && (
          <View style={styles.section}>
            <View style={styles.upsellContainer}>
              <Text style={styles.upsellTitle}>Health Analysis Unavailable</Text>
              <Text style={styles.upsellText}>
                We found this product, but official health scoring is unavailable. You can search the web for ingredients, or upgrade to Premium to analyze the product with AI.
              </Text>
              
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => {
                  const query = encodeURIComponent(`${product.name} 原材料`);
                  Linking.openURL(`https://www.google.com/search?q=${query}`);
                }}
              >
                <Text style={styles.secondaryButtonText}>🔍 Search Web for Ingredients</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.premiumButton}>
                <Text style={styles.premiumButtonText}>✨ Analyze with AI (Premium)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Alternatives Section (If score is not excellent and alternatives exist) */}
        {product.score !== null && product.score < 75 && product.alternatives && product.alternatives.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Healthier Alternatives</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.alternativesScroll}>
              {product.alternatives.map(alt => (
                <TouchableOpacity key={alt.id} style={styles.alternativeCard}>
                  <Image source={{ uri: alt.image }} style={styles.alternativeImage} />
                  <Text style={styles.alternativeName} numberOfLines={2}>{alt.name}</Text>
                  <ScoreBadge score={alt.score} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.textLight,
  },
  errorText: {
    fontSize: typography.sizes.lg,
    color: colors.error,
    marginBottom: spacing.lg,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: typography.weights.bold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  productHeader: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  productImage: {
    width: 100,
    height: 140,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  productInfo: {
    flex: 1,
    marginLeft: spacing.lg,
    justifyContent: 'center',
  },
  category: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textTransform: 'uppercase',
    fontWeight: typography.weights.bold,
    marginBottom: 4,
  },
  productName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreLabelContainer: {
    marginLeft: spacing.md,
  },
  scoreLabelText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.textLight,
    fontStyle: 'italic',
  },
  alternativesScroll: {
    flexDirection: 'row',
  },
  alternativeCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    marginRight: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  alternativeImage: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  alternativeName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.sm,
    height: 40,
  },
  upsellContainer: {
    backgroundColor: '#FFF0F5',
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFB6C1',
    alignItems: 'center',
  },
  upsellTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: '#D81B60',
    marginBottom: spacing.sm,
  },
  upsellText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  premiumButton: {
    backgroundColor: '#D81B60',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  premiumButtonText: {
    color: '#fff',
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.md,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D81B60',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  secondaryButtonText: {
    color: '#D81B60',
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.md,
  }
});
