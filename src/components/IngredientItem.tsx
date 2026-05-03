import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { Ingredient } from '../api/scannerService';
import { colors, spacing, typography } from '../theme/colors';

interface IngredientItemProps {
  ingredient: Ingredient;
}

export const IngredientItem: React.FC<IngredientItemProps> = ({ ingredient }) => {
  const getIcon = () => {
    switch (ingredient.safety) {
      case 'warning':
        return <AlertCircle color={colors.error} size={20} />;
      case 'caution':
        return <AlertTriangle color={colors.warning} size={20} />;
      case 'safe':
        return <CheckCircle color={colors.success} size={20} />;
    }
  };

  const getBackgroundColor = () => {
    switch (ingredient.safety) {
      case 'warning':
        return '#FEE2E2'; // light red
      case 'caution':
        return '#FEF3C7'; // light yellow
      case 'safe':
        return '#D1FAE5'; // light green
    }
  };

  const handlePress = () => {
    let title = '';
    let message = '';
    
    switch (ingredient.safety) {
      case 'warning':
        title = '⚠️ Warning';
        message = `${ingredient.name} is flagged as a potential health concern. This is typically due to high sugar, artificial additives, or preservatives.`;
        break;
      case 'safe':
        title = '✅ Safe';
        message = `${ingredient.name} is considered a healthy or safe ingredient (like whole foods, nuts, fruits, and vegetables).`;
        break;
      case 'caution':
        title = '⚠️ Caution';
        message = `${ingredient.name} is generally okay, but should be consumed in moderation.`;
        break;
    }
    
    Alert.alert(title, message);
  };

  return (
    <TouchableOpacity 
      style={[styles.container, { borderLeftColor: ingredient.safety === 'warning' ? colors.error : ingredient.safety === 'caution' ? colors.warning : colors.success }]}
      onPress={handlePress}
    >
      <View style={[styles.iconContainer, { backgroundColor: getBackgroundColor() }]}>
        {getIcon()}
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.name}>{ingredient.name}</Text>
        {ingredient.description && (
          <Text style={styles.description}>{ingredient.description}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    marginTop: 2,
  }
});
