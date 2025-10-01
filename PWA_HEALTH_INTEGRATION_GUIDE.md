# PWA Health Integration Guide

## Overview

This guide outlines the comprehensive approach for integrating Apple Health and Google Fit data into your PWA for real-time calorie tracking and health monitoring.

## Architecture

### 1. **Multi-Source Data Strategy**
- **Google Fit API**: Real-time data via OAuth 2.0
- **Apple Health**: File upload + native app bridge (Capacitor)
- **Manual Entry**: Fallback for data not available from APIs
- **Background Sync**: Service worker handles offline data and sync

### 2. **PWA Features Implemented**
- ✅ Service Worker with background sync
- ✅ Offline data storage (IndexedDB)
- ✅ Push notifications for health milestones
- ✅ Real-time dashboard with live updates
- ✅ Automatic sync when coming online
- ✅ Manual data entry capabilities

## Implementation Steps

### Step 1: Environment Setup

Add these environment variables to your `.env` file:

```env
# Google Fit API
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_API_KEY=your_google_api_key

# Supabase (already configured)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 2: Google Fit API Setup

1. **Create Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google Fit API

2. **Configure OAuth 2.0**:
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Authorized origins: Add your PWA domain
   - Authorized redirect URIs: Add your PWA domain

3. **API Key**:
   - Create API key with restrictions for Google Fit API
   - Add domain restrictions for security

### Step 3: Database Schema Updates

Add these columns to your `wearable_data` table:

```sql
-- Add source tracking
ALTER TABLE wearable_data ADD COLUMN source VARCHAR(20) DEFAULT 'manual';
ALTER TABLE wearable_data ADD COLUMN last_sync TIMESTAMP DEFAULT NOW();

-- Add indexes for better performance
CREATE INDEX idx_wearable_data_user_date ON wearable_data(user_id, date);
CREATE INDEX idx_wearable_data_source ON wearable_data(source);
```

### Step 4: Service Worker Registration

Update your main.tsx to register the health sync service worker:

```typescript
// In main.tsx
if ('serviceWorker' in navigator) {
  // Register main service worker
  navigator.serviceWorker.register('/sw.js');
  
  // Register health sync service worker
  navigator.serviceWorker.register('/sw-health-sync.js');
}
```

### Step 5: Component Integration

Add the RealTimeHealthDashboard to your main dashboard:

```typescript
// In your Dashboard component
import { RealTimeHealthDashboard } from '@/components/RealTimeHealthDashboard';

// Add to your dashboard JSX
<RealTimeHealthDashboard />
```

## Key Features

### 1. **Real-Time Data Sync**
- **Google Fit**: Live data via REST API
- **Apple Health**: File upload + native bridge
- **Background Sync**: Automatic sync every 5 minutes
- **Offline Support**: Data stored locally, synced when online

### 2. **Health Metrics Tracking**
- Steps count with daily goals
- Calories burned (active + resting)
- Active minutes tracking
- Heart rate monitoring
- Distance covered

### 3. **PWA-Specific Features**
- **Background Sync**: Service worker handles data sync
- **Push Notifications**: Health milestone alerts
- **Offline Storage**: IndexedDB for local data
- **Auto-Update**: PWA updates with new health features

### 4. **User Experience**
- **Live Dashboard**: Real-time health metrics
- **Progress Tracking**: Visual progress bars and goals
- **Manual Entry**: Fallback for missing data
- **Sync Status**: Clear indication of data source and sync status

## API Integration Details

### Google Fit API
```typescript
// Example API calls
const stepsData = await gapi.client.fitness.users.dataset.aggregate({
  userId: 'me',
  requestBody: {
    aggregateBy: [{
      dataTypeName: 'com.google.step_count.delta',
      dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
    }],
    bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
    startTimeMillis: startOfDay.getTime(),
    endTimeMillis: endOfDay.getTime()
  }
});
```

### Apple Health Integration
- **PWA**: XML file upload (current implementation)
- **Native**: HealthKit via Capacitor (future enhancement)

## Security Considerations

1. **OAuth 2.0**: Secure authentication with Google Fit
2. **API Key Restrictions**: Domain and API restrictions
3. **Data Encryption**: Sensitive health data encrypted in transit
4. **User Consent**: Clear permissions for health data access
5. **Data Retention**: Configurable data retention policies

## Performance Optimizations

1. **Caching Strategy**: 
   - Google Fit API responses cached for 5 minutes
   - Health data cached locally for 24 hours
   - Supabase data cached for 7 days

2. **Background Processing**:
   - Service worker handles sync without blocking UI
   - Chunked data processing for large datasets
   - Debounced API calls to prevent rate limiting

3. **Offline Support**:
   - IndexedDB for local data storage
   - Queue-based sync when online
   - Graceful degradation for offline scenarios

## Testing Strategy

1. **Unit Tests**: Test individual hooks and components
2. **Integration Tests**: Test API integrations
3. **E2E Tests**: Test complete user workflows
4. **PWA Tests**: Test service worker and offline functionality
5. **Performance Tests**: Test with large datasets

## Deployment Considerations

1. **HTTPS Required**: PWA requires secure context
2. **Service Worker**: Ensure proper caching headers
3. **API Limits**: Monitor Google Fit API usage
4. **Error Handling**: Graceful fallbacks for API failures
5. **Monitoring**: Track sync success rates and errors

## Future Enhancements

1. **Apple Health Web API**: When available
2. **Wearable Device Integration**: Direct device communication
3. **AI-Powered Insights**: Health trend analysis
4. **Social Features**: Share progress with friends
5. **Advanced Analytics**: Detailed health reporting

## Troubleshooting

### Common Issues

1. **Google Fit Authorization Fails**:
   - Check OAuth configuration
   - Verify domain restrictions
   - Ensure API is enabled

2. **Service Worker Not Updating**:
   - Clear browser cache
   - Check service worker registration
   - Verify manifest.json

3. **Offline Data Not Syncing**:
   - Check network connectivity
   - Verify IndexedDB permissions
   - Check service worker logs

### Debug Tools

1. **Chrome DevTools**: Service worker debugging
2. **Lighthouse**: PWA audit
3. **Network Tab**: API call monitoring
4. **Application Tab**: IndexedDB inspection

## Conclusion

This PWA approach provides a robust foundation for real-time health data tracking with:
- Multi-source data integration
- Offline-first architecture
- Real-time user experience
- Scalable service worker implementation
- Comprehensive error handling

The implementation balances user experience with technical constraints, providing a seamless health tracking experience across web and mobile platforms.
