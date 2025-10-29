# Strava Disconnect Implementation

## Overview
Proper implementation of Strava account disconnection following official Strava API guidelines.

## Implementation Details

### 1. Disconnect Button Component (`StravaDisconnectButton`)

Located in: `src/components/StravaConnectButton.tsx`

```typescript
export function StravaDisconnectButton({ 
  onClick, 
  disabled = false,
  size = 'default',
  className 
}: StravaDisconnectButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant="destructive"
      className={cn(
        heights[size],
        'px-6',
        className
      )}
    >
      Disconnect
    </Button>
  );
}
```

**Features:**
- Uses destructive variant (red) to indicate removal action
- Supports multiple sizes (sm, default, lg)
- Can be disabled during sync operations
- Follows UI consistency with other components

### 2. Disconnect Logic (`disconnectStrava` hook)

Located in: `src/hooks/useStravaAuth.ts`

**Two-Step Process:**

#### Step 1: Revoke with Strava API
```typescript
// Call Strava's deauthorization endpoint
const deauthResponse = await fetch('https://www.strava.com/oauth/deauthorize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: `access_token=${tokenData.access_token}`,
});
```

This follows Strava's official API documentation:
- **Endpoint**: `POST https://www.strava.com/oauth/deauthorize`
- **Parameter**: `access_token` (required)
- **Effect**: Invalidates all refresh tokens and access tokens for the athlete
- **Result**: Application is removed from athlete's apps settings page

#### Step 2: Clean Local Database
```typescript
// Delete the token from our database
const { error } = await supabase
  .from('strava_tokens')
  .delete()
  .eq('user_id', user.id);
```

**Error Handling:**
- If Strava API call fails, we continue with local deletion
- Ensures user can always disconnect even if Strava API is unreachable
- Logs warnings for debugging but doesn't block the operation

### 3. UI Integration

Located in: `src/pages/AppIntegrations.tsx`

```typescript
<StravaDisconnectButton
  onClick={async () => {
    await disconnectStrava();
    toast({
      title: "Strava disconnected",
      description: "Your Strava activities will no longer sync",
    });
  }}
  disabled={isStravaSyncing}
  size="default"
/>
```

**User Experience:**
- Button only shown when Strava is connected
- Disabled during active sync operations
- Shows clear confirmation toast message
- Updates UI immediately after disconnect

### 4. State Management

The disconnect process updates multiple states:
```typescript
setIsConnected(false);
setAthleteId(null);
setConnectionStatus({ isConnected: false });
```

This ensures:
- UI reflects disconnected state immediately
- No stale connection data remains
- User can reconnect without page refresh

## Strava API Compliance

Following official Strava Developer Guidelines:
- ✅ Uses official deauthorization endpoint
- ✅ Properly revokes access tokens
- ✅ Invalidates refresh tokens
- ✅ Removes app from user's settings
- ✅ Handles errors gracefully

## Security Considerations

1. **Token Retrieval**: Access token fetched only when needed for deauthorization
2. **Error Handling**: Continues with local deletion even if API fails
3. **State Cleanup**: All connection states cleared
4. **User Control**: User can disconnect at any time (except during sync)

## Testing

To test the disconnect functionality:

1. Connect Strava account
2. Verify connection shows in UI
3. Click "Disconnect" button
4. Verify:
   - Toast notification appears
   - UI updates to show disconnected state
   - Strava apps settings page shows app removed
   - Database record deleted

## Future Enhancements

Potential improvements:
- Confirmation dialog before disconnect
- Sync activity history before disconnect
- Export user data option
- More detailed disconnect feedback
