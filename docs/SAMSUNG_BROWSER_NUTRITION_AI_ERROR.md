# Samsung Browser - Nutrition AI Error Analysis

## Error Details

**Error Message**: 
```
POST https://eecdbddpzwedficnpenm.supabase.co/functions/v1/nutrition-ai 500 (Internal Server Error)
Nutrition AI error: FunctionsHttpError: Edge Function returned a non-2xx status code
```

**Affected**: Some users on Samsung Browser
**Location**: `FoodTrackerDialog.tsx` when analyzing food photos

---

## Root Cause Analysis

### Issue 1: Google GenAI SDK Compatibility

The `nutrition-ai` function uses `npm:@google/genai` which may have compatibility issues:

```typescript
// Line 2 in nutrition-ai/index.ts
import { GoogleGenAI } from "npm:@google/genai";

// Line 49
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
```

**Potential Problems**:
1. **NPM import in Deno**: Using `npm:` prefix might fail in certain edge runtime conditions
2. **SDK compatibility**: Google GenAI SDK might not be fully compatible with Deno edge runtime
3. **Network issues**: Samsung Browser might have stricter CORS or CSP policies

### Issue 2: Image Data Handling

Samsung Browser might handle image data URLs differently:

```typescript
// Lines 52-76 - Image processing logic
if (typeof image === 'string' && image.startsWith('http')) {
  // Fetch from URL
  const imgResp = await fetch(image);
  // Convert to base64...
} else if (typeof image === 'string' && image.startsWith('data:')) {
  // Parse data URL
  const commaIdx = image.indexOf(',');
  base64Data = image.substring(commaIdx + 1);
  // ...
}
```

**Samsung Browser Issues**:
- May send different image format/encoding
- Data URL parsing might fail
- CORS issues when fetching signed URLs

### Issue 3: Timeout Issues

Samsung Browser might be slower at:
- Network requests
- Base64 encoding/decoding
- Edge function execution

---

## Solutions

### Solution 1: Add Better Error Handling & Logging ⭐ RECOMMENDED

Add detailed error logging to identify the exact failure point:

```typescript
// Add to nutrition-ai/index.ts after line 48

try {
  console.log('Image type:', typeof image);
  console.log('Image starts with:', image?.substring?.(0, 20));
  console.log('GEMINI_API_KEY exists:', !!GEMINI_API_KEY);
  
  // Initialize Google GenAI
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  console.log('GoogleGenAI initialized successfully');
  
  // Prepare the image data
  let mimeType = "image/jpeg";
  let base64Data = "";
  
  if (typeof image === 'string' && image.startsWith('http')) {
    console.log('Fetching image from URL:', image.substring(0, 50));
    const imgResp = await fetch(image);
    console.log('Image fetch status:', imgResp.status);
    if (!imgResp.ok) {
      throw new Error(`Failed to fetch image from URL: ${imgResp.status}`);
    }
    // ... rest of processing
  } else if (typeof image === 'string' && image.startsWith('data:')) {
    console.log('Processing data URL');
    // ... rest of processing
  } else if (typeof image === 'string') {
    console.log('Processing raw base64');
    base64Data = image;
  } else {
    throw new Error('Unsupported image format: ' + typeof image);
  }
  
  console.log('Image prepared, base64 length:', base64Data.length);
  console.log('MIME type:', mimeType);
  
  const contents = [/* ... */];
  
  console.log('Calling Gemini API...');
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: contents,
  });
  console.log('Gemini API call successful');
  
} catch (geminiError) {
  console.error('=== GEMINI ERROR ===');
  console.error('Error name:', geminiError?.name);
  console.error('Error message:', geminiError?.message);
  console.error('Error stack:', geminiError?.stack);
  console.error('Full error:', JSON.stringify(geminiError, null, 2));
  // ... rest of error handling
}
```

### Solution 2: Fallback to Direct Gemini API Call

Replace Google GenAI SDK with direct REST API call:

```typescript
// Instead of using GoogleGenAI SDK
// Use direct fetch to Gemini API

const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          },
          {
            text: "Analyze this food image and return nutrition data..."
          }
        ]
      }]
    })
  }
);
```

This avoids SDK compatibility issues.

### Solution 3: Add Client-Side Browser Detection

Detect Samsung Browser and use alternative flow:

```typescript
// In FoodTrackerDialog.tsx

const isSamsungBrowser = () => {
  const ua = navigator.userAgent;
  return ua.includes('SamsungBrowser') || ua.includes('SAMSUNG');
};

const analyzeFood = async () => {
  if (isSamsungBrowser()) {
    // Use alternative method or show helpful message
    toast({
      title: "Samsung Browser Detected",
      description: "Using optimized upload method...",
    });
    
    // Maybe use food_search instead of food_photo
    // Or compress image more aggressively
  }
  
  // ... rest of code
};
```

### Solution 4: Increase Timeout & Add Retry Logic

Samsung Browser might need more time:

```typescript
// In FoodTrackerDialog.tsx, increase timeout

const edgeFunctionTimeout = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Analysis timeout')), 90000) // 90s instead of 60s
);

// Add Samsung-specific retry
if (isSamsungBrowser() && retryCount < 2) {
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s
  return attemptUpload();
}
```

### Solution 5: Image Compression for Samsung Browser

Samsung might send larger images:

```typescript
// Before upload, compress image if Samsung Browser
if (isSamsungBrowser() && file.size > 500000) { // > 500KB
  const compressed = await compressImage(file, {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.7
  });
  file = compressed;
}
```

---

## Recommended Implementation Plan

### Phase 1: Debugging (Immediate)

1. **Add comprehensive logging** to `nutrition-ai/index.ts`
2. **Ask affected users** to try again and check Supabase Edge Function logs
3. **Identify exact error** from logs

### Phase 2: Quick Fix (Same Day)

1. **Replace Google GenAI SDK** with direct REST API call (Solution 2)
2. **Add timeout handling** specific to Samsung Browser
3. **Deploy updated function**

### Phase 3: Long-term (This Week)

1. **Add browser detection** and optimized paths
2. **Implement image compression** for mobile browsers
3. **Add retry logic** with exponential backoff
4. **Add user feedback** ("Optimizing for your browser...")

---

## Files to Modify

1. **`supabase/functions/nutrition-ai/index.ts`**
   - Add detailed logging (lines 45-100)
   - Replace Google GenAI SDK with direct API call
   - Add better error messages

2. **`src/components/FoodTrackerDialog.tsx`**
   - Add browser detection
   - Increase timeout for Samsung Browser
   - Add image compression option

3. **`supabase/functions/_shared/gemini-api.ts`** (NEW)
   - Create shared helper for direct Gemini API calls
   - Reusable across functions

---

## Testing Checklist

After implementing fixes:

- [ ] Test on Samsung Browser (real device)
- [ ] Test on Chrome mobile
- [ ] Test on Safari iOS
- [ ] Check Supabase Edge Function logs for errors
- [ ] Verify image upload works with signed URLs
- [ ] Confirm nutrition data returns correctly
- [ ] Test with different image sizes
- [ ] Test with poor network conditions

---

## Immediate Action

**Deploy with enhanced logging first**, then check what the actual error is:

```bash
cd supabase/functions/nutrition-ai
# Add logging to index.ts
supabase functions deploy nutrition-ai
```

Then ask affected users to try again and check:
1. Browser console for client-side errors
2. Supabase Dashboard → Edge Functions → nutrition-ai → Logs

This will reveal the exact point of failure.
