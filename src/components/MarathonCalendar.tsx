import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, ExternalLink, Target, Clock, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format, isBefore, isAfter, addMonths } from 'date-fns';

interface MarathonEvent {
  id: string;
  event_name: string;
  event_date: string;
  location: string;
  country: string;
  distance: string;
  event_url: string | null;
  description: string | null;
  registration_deadline: string | null;
}

export function MarathonCalendar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<MarathonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<'all' | 'Indonesia' | 'International'>('all');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('marathon_events')
        .select('*')
        .gte('event_date', format(new Date(), 'yyyy-MM-dd'))
        .order('event_date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching marathon events:', error);
      toast({
        title: "Failed to load events",
        description: "Could not fetch marathon events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetAsGoal = async (event: MarathonEvent) => {
    if (!user) return;

    try {
      // Update user's profile with the selected race goal
      const { error } = await supabase
        .from('profiles')
        .update({
          fitness_goals: [event.event_name]
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Race goal set!",
        description: `${event.event_name} is now your target race`,
      });
    } catch (error) {
      console.error('Error setting race goal:', error);
      toast({
        title: "Failed to set goal",
        description: "Could not update your race goal",
        variant: "destructive",
      });
    }
  };

  const filteredEvents = events.filter(event => {
    if (selectedCountry === 'all') return true;
    if (selectedCountry === 'Indonesia') return event.country === 'Indonesia';
    return event.country !== 'Indonesia';
  });

  const getEventStatus = (event: MarathonEvent) => {
    const today = new Date();
    const eventDate = new Date(event.event_date);
    const deadline = event.registration_deadline ? new Date(event.registration_deadline) : null;

    if (deadline && isBefore(today, deadline)) {
      return { label: 'Registration Open', variant: 'default' as const };
    } else if (deadline && isAfter(today, deadline) && isBefore(today, eventDate)) {
      return { label: 'Registration Closed', variant: 'secondary' as const };
    } else if (isBefore(today, eventDate)) {
      return { label: 'Upcoming', variant: 'outline' as const };
    }
    return { label: 'Past Event', variant: 'destructive' as const };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle>Marathon Calendar</CardTitle>
        </div>
        <CardDescription>
          Upcoming marathon events in Indonesia and worldwide
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedCountry} onValueChange={(v) => setSelectedCountry(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All Events</TabsTrigger>
            <TabsTrigger value="Indonesia">🇮🇩 Indonesia</TabsTrigger>
            <TabsTrigger value="International">🌍 International</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedCountry} className="space-y-4 mt-4">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No upcoming events found
              </div>
            ) : (
              filteredEvents.map((event) => {
                const status = getEventStatus(event);
                const eventDate = new Date(event.event_date);

                return (
                  <Card key={event.id} className="premium-card">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              {event.event_name}
                              <Badge variant={status.variant} className="text-xs">
                                {status.label}
                              </Badge>
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(eventDate, 'MMM dd, yyyy')}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}, {event.country}
                              </span>
                            </div>
                          </div>
                        </div>

                        {event.description && (
                          <p className="text-sm text-muted-foreground">
                            {event.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 text-sm">
                          <Target className="h-3 w-3 text-primary" />
                          <span className="font-medium">{event.distance}</span>
                        </div>

                        {event.registration_deadline && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Registration deadline: {format(new Date(event.registration_deadline), 'MMM dd, yyyy')}
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleSetAsGoal(event)}
                            className="flex-1"
                          >
                            <Target className="h-3 w-3 mr-2" />
                            Set as Race Goal
                          </Button>
                          {event.event_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a
                                href={event.event_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Visit Site
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}