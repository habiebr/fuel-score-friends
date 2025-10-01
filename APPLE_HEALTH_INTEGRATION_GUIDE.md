# Apple Health Integration Guide

## 🍎 Overview

Nutrisync now supports comprehensive Apple Health integration, allowing users to automatically sync their fitness and health data for personalized nutrition insights.

## ✨ Features

### Real-time Sync (iOS Native App)
- **Automatic Data Sync**: Continuously syncs health data from Apple Health
- **Multiple Data Types**: Steps, calories, heart rate, distance, active minutes
- **Historical Data**: Access to past 7 days of health data
- **Privacy First**: All data stays on device, no third-party sharing

### Manual Upload (PWA/Web)
- **XML Export Support**: Upload Apple Health export files
- **Cross-platform**: Works on all devices and browsers
- **Batch Processing**: Handles large health data exports efficiently

## 🔧 Technical Implementation

### Dependencies
```json
{
  "capacitor-health": "^7.0.0"
}
```

### Supported Health Data Types
- **Steps**: Daily step count for activity tracking
- **Active Calories**: Calories burned through physical activity
- **Heart Rate**: Resting and active heart rate measurements
- **Distance**: Walking and running distance in kilometers
- **Active Minutes**: Time spent in active exercise

### Database Schema
```sql
-- wearable_data table structure
CREATE TABLE wearable_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  steps INTEGER DEFAULT 0,
  calories_burned INTEGER DEFAULT 0,
  active_minutes INTEGER DEFAULT 0,
  heart_rate_avg INTEGER DEFAULT 0,
  distance_km DECIMAL(5,2) DEFAULT 0,
  source TEXT CHECK (source IN ('apple_health', 'google_fit', 'manual')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);
```

## 🚀 Setup Instructions

### 1. iOS App Configuration

#### Enable HealthKit in Xcode
1. Open your project in Xcode
2. Select your app target
3. Go to "Signing & Capabilities" tab
4. Click "+ Capability" and add "HealthKit"
5. Configure the required data types:
   - Health Records (Read)
   - Workout Data (Read)
   - Activity Data (Read)

#### Info.plist Configuration
Add the following to your `Info.plist`:

```xml
<key>NSHealthShareUsageDescription</key>
<string>Nutrisync uses your health data to provide personalized nutrition insights and track your fitness progress.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>Nutrisync can write nutrition data back to Apple Health to keep your health records complete.</string>
```

### 2. Capacitor Configuration

The `capacitor.config.ts` is already configured with the required health data types:

```typescript
plugins: {
  Health: {
    read: ['steps', 'calories', 'heartRate', 'distance', 'activeMinutes'],
    write: []
  }
}
```

### 3. Build and Deploy

```bash
# Install dependencies
npm install

# Sync Capacitor
npx cap sync

# Build for iOS
npm run build
npx cap copy ios
npx cap open ios
```

## 📱 User Experience

### Permission Flow
1. **First Launch**: Users see a permission dialog explaining data usage
2. **Granular Permissions**: Users can choose which data types to share
3. **Privacy Notice**: Clear explanation of data handling and privacy
4. **Settings Access**: Easy access to modify permissions later

### Sync Experience
- **Automatic Sync**: Data syncs automatically when app is opened
- **Manual Sync**: Users can trigger sync manually
- **Status Indicators**: Clear visual feedback on sync status
- **Error Handling**: Graceful handling of permission denials and sync failures

## 🔒 Privacy & Security

### Data Handling
- **Local Processing**: All health data processing happens on device
- **Encrypted Storage**: Health data is encrypted in Supabase
- **No Third-party Sharing**: Data is never shared with external services
- **User Control**: Users can revoke permissions at any time

### Compliance
- **Apple Guidelines**: Follows all Apple HealthKit guidelines
- **GDPR Compliant**: Respects user privacy and data rights
- **Transparent Policies**: Clear data usage explanations

## 🧪 Testing

### iOS Simulator Limitations
- HealthKit is not available in iOS Simulator
- Test on physical iOS devices only
- Use manual XML upload for development testing

### Test Scenarios
1. **Permission Granting**: Test all permission combinations
2. **Data Sync**: Verify accurate data retrieval and storage
3. **Error Handling**: Test network failures and permission denials
4. **Performance**: Ensure smooth operation with large datasets

## 🔄 Data Flow

### Real-time Sync (iOS)
```
Apple Health → HealthKit API → Capacitor Health Plugin → useHealthKit Hook → Supabase Database
```

### Manual Upload (PWA)
```
Apple Health Export → XML Parser → Data Processing → Supabase Database
```

## 📊 Health Metrics Integration

### Nutrition Scoring
Health data is integrated into the nutrition scoring algorithm:
- **Activity Level**: Adjusts calorie recommendations
- **Heart Rate**: Influences metabolic calculations
- **Steps**: Contributes to daily activity score
- **Distance**: Used for exercise intensity assessment

### Personalized Insights
- **Goal Adjustment**: Health data influences daily goals
- **Meal Timing**: Activity patterns inform meal suggestions
- **Recovery Tracking**: Heart rate data helps track recovery
- **Progress Visualization**: Health trends in dashboard

## 🛠️ Troubleshooting

### Common Issues

#### Permission Denied
- Check Health app settings
- Verify Info.plist configuration
- Ensure proper capability setup in Xcode

#### Sync Failures
- Check network connectivity
- Verify Supabase configuration
- Review error logs in console

#### Data Inconsistencies
- Clear app data and re-sync
- Check timezone settings
- Verify data source accuracy

### Debug Commands
```bash
# Check Capacitor sync
npx cap sync

# View iOS logs
npx cap run ios --livereload

# Check plugin status
npx cap doctor
```

## 🚀 Future Enhancements

### Planned Features
- **Workout Integration**: Detailed workout data sync
- **Sleep Tracking**: Sleep quality and duration
- **Body Measurements**: Weight, BMI, body fat percentage
- **Nutrition Writing**: Write nutrition data back to Health
- **Health Trends**: Long-term health trend analysis

### Advanced Integrations
- **WatchOS Support**: Apple Watch specific metrics
- **Health Connect**: Android Health Connect integration
- **Third-party Apps**: Integration with other fitness apps
- **AI Insights**: Machine learning powered health insights

## 📚 Resources

### Documentation
- [Apple HealthKit Documentation](https://developer.apple.com/health-fitness/)
- [Capacitor Health Plugin](https://github.com/mley/capacitor-health)
- [HealthKit Privacy Guidelines](https://developer.apple.com/app-store/review/guidelines/#healthkit)

### Support
- Check the troubleshooting section above
- Review Apple's HealthKit guidelines
- Test on physical iOS devices
- Verify all permissions are properly configured

---

**Note**: This integration requires iOS 12.0+ and is only available on physical iOS devices. The PWA version supports manual upload of Apple Health export files for cross-platform compatibility.
