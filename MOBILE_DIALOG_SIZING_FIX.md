# Mobile Dialog Sizing Fix

## Issue
Dialogs were too wide on mobile phones, extending beyond the viewport and causing horizontal scrolling or cut-off content.

## Root Cause
Dialogs were using fixed max-widths (e.g., `sm:max-w-md`, `max-w-2xl`, `max-w-4xl`) without constraining them on mobile devices. This caused them to overflow on narrow screens.

## Solution
Added responsive width constraints to all dialogs:
- Mobile: `max-w-[95vw]` (95% of viewport width with 5% margin)
- Desktop: Original max-width preserved (e.g., `sm:max-w-md`, `sm:max-w-2xl`, etc.)

This ensures dialogs:
1. Never exceed the viewport width on mobile
2. Maintain proper spacing from screen edges
3. Keep their designed desktop width on larger screens

## Files Fixed

### 1. FoodLogEditDialog.tsx ✅
**Before**: `className="sm:max-w-md"`  
**After**: `className="max-w-[95vw] sm:max-w-md"`

**Impact**: Meal/food log edit dialog now fits properly on all mobile devices

### 2. FoodTrackerDialog.tsx ✅
**Before**: `className="sm:max-w-md"`  
**After**: `className="max-w-[95vw] sm:max-w-md"`

**Impact**: Food photo upload dialog now fits properly on mobile

### 3. ExercisePlanDialog.tsx ✅
**Before**: `className="max-w-2xl max-h-[90vh] overflow-y-auto"`  
**After**: `className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto"`

**Impact**: Weekly exercise plan dialog now fits on mobile

### 4. FitnessScreenshotDialog.tsx ✅
**Before**: `className="max-w-4xl max-h-[90vh] overflow-y-auto"`  
**After**: `className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto"`

**Impact**: Fitness screenshot/instant suggestion dialog now fits on mobile

### 5. OnboardingDialog.tsx ✅
**Before**: `className="sm:max-w-md"`  
**After**: `className="max-w-[95vw] sm:max-w-md"`

**Impact**: Welcome/onboarding dialog now fits on all devices

## Technical Details

### Responsive Sizing Strategy

```tsx
// Mobile-first approach
max-w-[95vw]     // Mobile: 95% of viewport width
sm:max-w-md      // Desktop (≥640px): 448px max width
sm:max-w-2xl     // Desktop (≥640px): 672px max width
sm:max-w-4xl     // Desktop (≥640px): 896px max width
```

### Why 95vw?
- Leaves 2.5% margin on each side (total 5%)
- Prevents dialogs from touching screen edges
- Accounts for safe areas on devices with notches
- Works with the existing safe-area-inset padding in dialog.tsx

### Existing Dialog Base Styles
The base `Dialog` component (dialog.tsx) already has:
- Mobile: Full-screen with `inset-0`
- Desktop: Centered modal with max-height constraints
- Safe-area-inset padding for PWA/notched devices

The fix complements these existing styles by adding width constraints.

## Testing

### Devices to Test:
- ✅ iPhone SE (375px width) - Smallest modern phone
- ✅ iPhone 14 Pro (393px width)
- ✅ Standard Android phones (360px-400px)
- ✅ Tablets (768px+)
- ✅ Desktop (1024px+)

### Test Scenarios:
1. Open Food Log Edit Dialog → Should fit without horizontal scroll
2. Open Food Tracker Dialog → Should fit properly
3. Open Exercise Plan Dialog → Should fit with all form fields visible
4. Open Fitness Screenshot Dialog → Should fit with all content visible
5. Open Onboarding Dialog → Should fit on first app launch

### Expected Behavior:
- **Mobile (< 640px)**: Dialog takes up max 95% viewport width
- **Desktop (≥ 640px)**: Dialog uses original max-width constraints
- **All devices**: No horizontal scrolling
- **All devices**: Content remains visible and accessible

## Browser Compatibility

The `max-w-[95vw]` uses viewport width units which are supported in:
- ✅ All modern browsers
- ✅ iOS Safari 6+
- ✅ Android Chrome 4.4+
- ✅ All PWA environments

## Related Components

### Dialog Base Component (dialog.tsx)
Already handles:
- Responsive layout (full-screen mobile, centered desktop)
- Safe-area-inset padding
- Scrolling overflow
- Animations

### This fix adds:
- Width constraints for mobile
- Prevents content overflow
- Maintains desktop sizing

## Deployment

No breaking changes - this is a pure CSS enhancement.

**Impact**: Immediate improvement for all mobile users

**Backwards Compatible**: Yes, desktop users see no change

**Requires**: Frontend deployment only (no backend changes)

## Success Criteria

- ✅ No horizontal scrolling on any dialog
- ✅ All form fields visible without scrolling
- ✅ Proper margins from screen edges
- ✅ Desktop appearance unchanged
- ✅ Works on all device sizes

---

**Status**: ✅ **FIXED**

All dialogs now properly sized for mobile devices while maintaining their desktop appearance.
