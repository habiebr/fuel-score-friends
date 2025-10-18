# 📦 Packaged Product Verification System

## Overview

To ensure macronutrient accuracy for packaged foods, the system now includes **mandatory verification** that packaged products use USDA or nutrition label data (not estimation).

---

## 🔍 Detection & Verification Flow

```
User uploads food photo
         ↓
Gemini AI analyzes
         ↓
Is it a packaged product?
    ├─ NO → Use standard validation ✓
    └─ YES ↓
      Verify data source:
      ├─ From nutrition label? ✅ VERIFIED
      ├─ From USDA database? ✅ VERIFIED
      └─ Estimated? ⚠️ WARNING
           ↓
      Flag for verification if:
      - Highly branded (Coca-Cola, Cheetos, etc.)
      - Macro-calorie mismatch
      - Missing verification indicator
           ↓
      Include warnings in response
```

---

## ✅ Packaged Product Detection

Products requiring verification:

### 🚨 Highly Branded (Must use label/USDA):
- **Sodas**: Coca-Cola, Pepsi, Sprite, Fanta, Mountain Dew
- **Chips**: Cheetos, Doritos, Lay's, Pringles
- **Cereals**: Cheerios, Frosted Flakes, Lucky Charms
- **Candy**: Snickers, Mars, Milky Way, Twix, Reese's
- **Yogurt**: Yoplait, Dannon, Greek yogurt brands
- **Protein Bars**: Quest, Clif, Nature Valley

### 📦 General Packaged Indicators:
- Cereal, bar, chip, snack
- Drink, soda, juice
- Yogurt, milk, butter, cheese
- Cookie, frozen, instant, processed

---

## 📋 Verification Sources

### ✅ VERIFIED SOURCES:
1. **Nutrition Label** (visible in photo)
   - Takes priority - most accurate
   - Must match macros reasonably
   
2. **USDA FoodData Central**
   - Official database
   - Gold standard for packaged foods
   - https://fdc.nal.usda.gov/

3. **Manufacturer Data**
   - Official nutrition information
   - Brand websites often have verified data

### ❌ NOT VERIFIED:
- Estimation (even from AI)
- Online forums/blogs
- Non-official sources
- User guesses

---

## 🎯 Verification Algorithm

```typescript
function verifyPackagedProductNutrition(foodName, nutritionData) {
  
  // Step 1: Check if label was used
  hasLabel = foodName.includes('label') || 'nutrition'
  
  // Step 2: Check if highly branded
  isHighlyBranded = matchesKnownBrands(foodName)
  
  // Step 3: If branded but no label indication
  if (isHighlyBranded && !hasLabel) {
    warning: "Must verify with nutrition label or USDA"
  }
  
  // Step 4: Macro-calorie sanity check
  calculated = (protein×4) + (carbs×4) + (fat×9)
  if (|calculated - reported| > 30%) {
    warning: "Macros don't match - verify label/USDA"
  }
  
  return {
    isVerified: hasLabel || isHighlyBranded,
    source: hasLabel ? 'label' : 'usda_database',
    warnings: [...]
  }
}
```

---

## 📊 Response Structure

### Fresh Food (No Verification):
```json
{
  "nutritionData": {
    "food_name": "Grilled chicken breast",
    "serving_size": "150g (5oz)",
    "calories": 280,
    "protein_grams": 53,
    "carbs_grams": 0,
    "fat_grams": 6
  },
  "validation": {
    "isPackaged": false,
    "packagedVerification": null,
    "warnings": null
  }
}
```

### Packaged Product (With Verification):
```json
{
  "nutritionData": {
    "food_name": "Coca-Cola Classic (12oz can)",
    "serving_size": "1 can (355ml)",
    "calories": 140,
    "protein_grams": 0,
    "carbs_grams": 39,
    "fat_grams": 0
  },
  "validation": {
    "isPackaged": true,
    "packagedVerification": {
      "isVerified": true,
      "source": "nutrition_label",
      "usedLabel": true
    },
    "warnings": null
  }
}
```

### Packaged Product (With Warnings):
```json
{
  "nutritionData": { ... },
  "validation": {
    "isPackaged": true,
    "packagedVerification": {
      "isVerified": false,
      "source": "usda_database",
      "usedLabel": false
    },
    "warnings": [
      "⚠️ PACKAGED PRODUCT: Cheetos is a branded product. Nutrition data MUST come from the nutrition label or official USDA database, not estimation. Please verify this data is accurate."
    ]
  }
}
```

---

## 🧪 Testing Verification

### Test Case 1: Branded Product with Label
```
Photo: Package of Cheerios with nutrition label visible
Expected:
- source: "nutrition_label"
- isVerified: true
- warnings: null
```

### Test Case 2: Branded Product without Label
```
Photo: Cheetos bag (no label visible)
Expected:
- source: "usda_database"
- isVerified: false
- warnings: ["Must verify with USDA..."]
```

### Test Case 3: Fresh Food
```
Photo: Cooked chicken breast
Expected:
- isPackaged: false
- packagedVerification: null
```

---

## 🛡️ Verification Requirements by Category

| Product Type | Label Required? | USDA Allowed? | Estimated OK? |
|--------------|-----------------|---------------|---------------|
| Branded soda | ✅ YES | ✅ YES | ❌ NO |
| Branded cereal | ✅ YES | ✅ YES | ❌ NO |
| Branded snacks | ✅ YES | ✅ YES | ❌ NO |
| Generic packaged | ✅ YES | ✅ YES | ❌ NO |
| Fresh fruit | ❌ NO | ✅ YES | ⚠️ Maybe |
| Fresh vegetable | ❌ NO | ✅ YES | ✅ YES |
| Home-cooked meal | ❌ NO | ❌ NO | ✅ YES |

---

## 🔗 Integration with Nutrition-AI

### Prompt Instructions to Gemini:
```
For packaged products: Use verified nutrition data from:
- Nutrition labels visible in image
- USDA FoodData Central database
- Manufacturer's official nutrition information
- DO NOT guess nutrition for branded products
```

### Validation Chain:
1. Gemini analyzes image
2. Returns food_name + nutrition data
3. validatePackagedProduct() detects if packaged
4. verifyPackagedProductNutrition() checks sources
5. Returns verification metadata + warnings
6. User sees warnings before confirming

---

## 📝 User Experience

### When Logging Branded Food:

1. **Photo uploaded** → Gemini analyzes
2. **Results shown** with warning if needed:
   ```
   "⚠️ This is a packaged product. 
   Please verify the nutrition label 
   or use USDA database data."
   ```
3. **User confirms** → Data logged with metadata
4. **Later review** → System knows it was verified

---

## 🚀 Future Enhancements

1. **Direct USDA API integration**
   - Real-time lookup by product name
   - Automatic verification

2. **Barcode scanning**
   - Scan UPC code
   - Fetch verified nutrition data

3. **Label OCR**
   - Read nutrition label directly from photo
   - Extract values automatically

4. **Branded product database**
   - Pre-verified common products
   - Quick lookup by brand + size

5. **Manual user verification**
   - User can confirm they read the label
   - Stores verification date/time

---

## ✨ Summary

**Packaged products now:**
- ✅ Require verification from label or USDA
- ✅ Show warnings if data is unverified
- ✅ Flag highly branded items
- ✅ Validate macro-calorie consistency
- ✅ Provide verification metadata in response

This ensures **accurate nutrition tracking** for boxed/canned/bottled foods!

