import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  Bell, 
  Clock, 
  CheckCircle, 
  X, 
  AlertCircle,
  Coffee,
  Apple,
  Activity
} from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { NotificationService } from '@/services/notification.service';

interface TrainingNotification {
  id: string;
  user_id: string;
  type: 'pre_training' | 'post_training' | 'recovery';
  title: string;
  message: string;
  scheduled_for: string;
  training_date: string;
  activity_type: string;
  is_read: boolean;
  created_at: string;
}

export function TrainingNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<TrainingNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const data = await NotificationService.getNotifications(user.id, 5);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await NotificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await NotificationService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast({
        title: "Deleted",
        description: "Notification removed",
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    
    try {
      await NotificationService.markAllAsRead(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast({
        title: "Marked all as read",
        description: "All notifications marked as read",
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'pre_training': return <Coffee className="h-4 w-4 text-blue-500" />;
      case 'post_training': return <Apple className="h-4 w-4 text-green-500" />;
      case 'recovery': return <Activity className="h-4 w-4 text-orange-500" />;
      default: return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'pre_training': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'post_training': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'recovery': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (notifications.length === 0 && !loading) {
    return null;
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Training Notifications</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-xs"
            >
              Mark all read
            </Button>
          )}
        </div>
        <CardDescription>
          Nutrition recommendations for your training
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading notifications...</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg border ${
                notification.is_read 
                  ? 'bg-muted/50 border-muted' 
                  : 'bg-primary/5 border-primary/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-foreground truncate">
                      {notification.title}
                    </h4>
                    <Badge className={getNotificationColor(notification.type)}>
                      {notification.type.replace('_', ' ')}
                    </Badge>
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {isToday(new Date(notification.scheduled_for)) ? 'Today' :
                       isTomorrow(new Date(notification.scheduled_for)) ? 'Tomorrow' :
                       format(new Date(notification.scheduled_for), 'MMM dd')}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{notification.activity_type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!notification.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="h-6 w-6 p-0"
                    >
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(notification.id)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
        
        {notifications.length === 0 && !loading && (
          <div className="text-center py-6">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground">
              You'll receive nutrition recommendations for your training
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
