# 🌏 Regional Database Support - Australia & Indonesia

## Overview

The nutrition AI now supports **region-specific nutrition databases** for Australia and Indonesia, ensuring accurate macronutrient data for foods popular in these regions.

---

## 🗺️ Supported Regions & Databases

### USA (Default)
```
Database: USDA FoodData Central
URL: https://fdc.nal.usda.gov/
Coverage: 400,000+ foods
Use Case: Most comprehensive; default for unmapped regions
```

### 🇦🇺 Australia
```
Database: NUTTAB (Australian Food Composition Database)
URL: https://www.foodstandards.gov.au/nuttab
Coverage: 5,000+ Australian & international foods
Maintained By: Food Standards Australia New Zealand
Best For: Australian branded products, local foods
```

### 🇮🇩 Indonesia
```
Database: Indonesian Food Composition Database
URL: https://www.panganku.org/
Coverage: 2,000+ Indonesian foods
Maintained By: Indonesian Ministry of Health
Best For: Indonesian foods, traditional dishes, local brands
```

---

## 🔍 Region Detection

The system automatically detects region from:

### 1. **Food Name** (Auto-detect):
```
Australian Foods:
✓ Vegemite, Tim Tam, Anzac, Lamington
✓ Weetabix, Milo, Bushells Tea
✓ Farmers Union, Bega, Mainland

Indonesian Foods:
✓ Indomie, Mie Goreng
✓ Rendang, Soto, Satay
✓ Tahu, Tempe, Krupuk
```

### 2. **Region Parameter** (Explicit):
Send region in request:
```json
{
  "type": "food_photo",
  "image": "...",
  "mealType": "lunch",
  "region": "australia"
}
```

---

## 📦 Verified Brands by Region

### 🇦🇺 Australian Brands (Require Verification)
```
Spreads:
- Vegemite
- Marmite

Biscuits:
- Tim Tam
- Anzac
- Lamington
- Arnott's
- McVitie's

Beverages:
- Milo
- Horlicks
- Bushells Tea
- Liptons Tea

Dairy:
- Farmers Union
- Bega
- Mainland
- Kraft

Cereals:
- Weetabix
```

### 🇮🇩 Indonesian Brands (Require Verification)
```
Instant Noodles:
- Indomie
- Mie Goreng variants

Beverages:
- Sunburst
- Pocari Sweat
- Nescafe
- Kapal Api (Coffee)

Snacks:
- Chitato
- Lays (Indonesian variants)

Condiments:
- ABC Sauce
- Kecap Manis

Protein:
- Tahu Kuali
- Tempe Mendoan

Crackers:
- Krupuk
- Perkedel
```

---

## 🧪 Detection & Verification Flow

```
User uploads food photo
         ↓
Detect region from:
├─ Food name patterns
├─ Explicit region parameter
└─ User profile (future)
         ↓
Load region-specific database info:
├─ Database name
├─ URL
├─ Verification requirements
└─ Known brands
         ↓
Gemini AI analyzes with region context
         ↓
Get AI response with food data
         ↓
Verify against regional branded products
         ↓
If brand detected:
├─ Require label/database verification
└─ Show region-specific warning
         ↓
Return response with:
├─ Database used
├─ Region identified
├─ Verification status
└─ Warnings if needed
```

---

## 📊 Response Structure with Region

### Australian Food (With Region):
```json
{
  "nutritionData": {
    "food_name": "Tim Tam (1 biscuit)",
    "serving_size": "1 biscuit (12g)",
    "calories": 60,
    "protein_grams": 0.7,
    "carbs_grams": 7.5,
    "fat_grams": 3.2
  },
  "validation": {
    "isPackaged": true,
    "packagedVerification": {
      "isVerified": true,
      "source": "nutrition_label",
      "database": "NUTTAB (Australian Food Composition Database)",
      "region": "Australia",
      "usedLabel": true
    },
    "warnings": null
  }
}
```

### Indonesian Food (With Region):
```json
{
  "nutritionData": {
    "food_name": "Indomie Mie Goreng (prepared)",
    "serving_size": "1 package prepared (160g)",
    "calories": 390,
    "protein_grams": 8,
    "carbs_grams": 52,
    "fat_grams": 16
  },
  "validation": {
    "isPackaged": true,
    "packagedVerification": {
      "isVerified": false,
      "source": "database",
      "database": "Indonesian Food Composition Database",
      "region": "Indonesia",
      "usedLabel": false
    },
    "warnings": [
      "⚠️ PACKAGED PRODUCT (Indonesia): Indomie Mie Goreng is a branded product. Nutrition data MUST come from the nutrition label or official Indonesian Food Composition Database, not estimation. Please verify this data is accurate."
    ]
  }
}
```

---

## 🛡️ Verification Rules by Region

### Australia (NUTTAB)
| Product Type | Label Required? | NUTTAB Allowed? | Estimated OK? |
|--------------|-----------------|------------------|---------------|
| Branded drink | ✅ YES | ✅ YES | ❌ NO |
| Tim Tam/biscuits | ✅ YES | ✅ YES | ❌ NO |
| Dairy/cheese | ✅ YES | ✅ YES | ❌ NO |
| Fresh produce | ❌ NO | ✅ YES | ✅ YES |
| Local meat | ❌ NO | ✅ YES | ✅ YES |
| Home-cooked meal | ❌ NO | ❌ NO | ✅ YES |

### Indonesia (Indonesian FCD)
| Product Type | Label Required? | FCD Allowed? | Estimated OK? |
|--------------|-----------------|--------------|---------------|
| Indomie | ✅ YES | ✅ YES | ❌ NO |
| Pocari Sweat | ✅ YES | ✅ YES | ❌ NO |
| Instant noodles | ✅ YES | ✅ YES | ❌ NO |
| Traditional foods | ❌ NO | ✅ YES | ⚠️ Maybe |
| Satay/rendang | ❌ NO | ✅ YES | ✅ YES |
| Home-cooked meal | ❌ NO | ❌ NO | ✅ YES |

---

## 📱 Frontend Integration

### Sending Region to Backend:

```typescript
// Option 1: Auto-detect from food name
const response = await supabase.functions.invoke('nutrition-ai', {
  body: {
    type: 'food_photo',
    image: signedUrl,
    mealType: 'lunch'
    // Region will auto-detect from food name
  }
});

// Option 2: Explicit region from user profile
const userRegion = user.region || 'australia'; // from profile
const response = await supabase.functions.invoke('nutrition-ai', {
  body: {
    type: 'food_photo',
    image: signedUrl,
    mealType: 'lunch',
    region: userRegion
  }
});
```

### Storing Region in User Profile:

```sql
-- Add region to profiles table (if not already present)
ALTER TABLE profiles ADD COLUMN region VARCHAR(50);

-- Update values
UPDATE profiles SET region = 'australia' WHERE country = 'AU';
UPDATE profiles SET region = 'indonesia' WHERE country = 'ID';
```

---

## 🚀 Implementation Checklist

- [x] Detect regional foods in AI prompt
- [x] Support USDA, NUTTAB, Indonesian FCD
- [x] Region-specific branded products
- [x] Auto-detect region from food name
- [x] Return region metadata in response
- [x] Include database name in verification
- [ ] Add region selection to user profile UI
- [ ] Store region in user preferences
- [ ] Show region in food logging confirmation
- [ ] Future: Barcode lookup per region

---

## 🔗 Database URLs

**For direct manual lookups:**

- **USDA FoodData Central**: https://fdc.nal.usda.gov/
- **NUTTAB**: https://www.foodstandards.gov.au/nuttab
- **Indonesian FCD**: https://www.panganku.org/

---

## 📝 Testing

### Test Case 1: Australian Product
```
Photo: Tim Tam package with nutrition label
Expected:
- region: "Australia"
- database: "NUTTAB (Australian Food Composition Database)"
- isVerified: true
```

### Test Case 2: Indonesian Product
```
Photo: Indomie Mie Goreng package
Expected:
- region: "Indonesia"
- database: "Indonesian Food Composition Database"
- warnings: ["PACKAGED PRODUCT..."]
```

### Test Case 3: Fresh Food (Auto-detect)
```
Photo: Cooked rendang
Expected:
- region: "Indonesia" (auto-detected)
- isPackaged: false
```

---

## 💡 Future Enhancements

1. **User Profile Region**
   - Store in `profiles.region`
   - Default for all uploads
   - Changeable in settings

2. **Multi-language Support**
   - Food names in local languages
   - UI in Bahasa Indonesia, English, etc.

3. **Local Recipe Database**
   - Pre-verified Australian recipes
   - Pre-verified Indonesian recipes
   - Quick logging for common meals

4. **Barcode Integration**
   - Scan UPC/barcode
   - Lookup in region-specific databases
   - Instant verification

5. **Cultural Food Accuracy**
   - Traditional preparation variations
   - Regional ingredient swaps
   - Seasonal availability

---

## ✨ Summary

**Multi-region support now includes:**
- ✅ Auto-detection from food names
- ✅ Explicit region parameters
- ✅ NUTTAB for Australia
- ✅ Indonesian FCD for Indonesia
- ✅ Region-specific branded products
- ✅ Verification metadata in responses
- ✅ Database reference in warnings

This ensures **accurate nutrition tracking** across Australia, Indonesia, and USA!

