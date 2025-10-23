import { useNavigate } from 'react-router-dom';
import { startTransition } from 'react';
import { ArrowLeft, GraduationCap, Users, Heart, MapPin, Calendar, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AboutNutriSync() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => startTransition(() => navigate(-1))}
              className="p-2 hover:bg-muted rounded-md transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <Heart className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">About Nutrisync</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Logo and Introduction */}
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                <Heart className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">Welcome to Nutrisync</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Your smart nutrition and training companion designed specifically for marathon runners and endurance athletes.
              </p>
            </div>
          </div>

          {/* Development Status */}
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <Calendar className="h-5 w-5" />
                Development Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <Badge variant="outline" className="mb-3 border-amber-300 text-amber-700 dark:text-amber-300">
                  Currently in Development
                </Badge>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Nutrisync is still in active development. We're continuously improving our AI-powered nutrition analysis, 
                  meal planning algorithms, and user experience based on your valuable feedback.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">What's Coming Next</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span>Integration with certified nutritionists for personalized meal plans</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span>Advanced AI models for more accurate nutrition analysis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span>Expanded Indonesian food database with local ingredients</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span>Enhanced training integration with more fitness platforms</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Capstone Project */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Capstone Project
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-primary">University of Melbourne</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Master of Entrepreneurship, Cohort 2025
                </p>
              </div>
              
              <p className="text-muted-foreground">
                Nutrisync is developed as part of a capstone project by Indonesian students pursuing their 
                Master of Entrepreneurship at the University of Melbourne. This project represents our commitment 
                to applying cutting-edge technology to solve real-world nutrition challenges for athletes.
              </p>
              
              <div className="space-y-3">
                <h3 className="font-semibold">Our Mission</h3>
                <p className="text-sm text-muted-foreground">
                  To democratize access to personalized nutrition guidance for endurance athletes, 
                  combining academic research with practical AI solutions to help runners achieve their 
                  performance goals through better nutrition and training.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Beta Program */}
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <Users className="h-5 w-5" />
                Beta Testing Program
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Thank you for joining our beta!</strong> Your participation is invaluable in helping us 
                  refine NutriSync before our official launch.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="font-semibold">Your Feedback Matters</h3>
                <p className="text-sm text-muted-foreground">
                  As beta testers, your insights help us understand how real athletes use our platform. 
                  Every bug report, feature request, and user experience feedback brings us closer to 
                  creating the perfect nutrition companion for runners.
                </p>
                
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Share your feedback through the app or contact us directly
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Future Plans */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Indonesian Market Launch
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Our ultimate goal is to launch Nutrisync in the Indonesian market, bringing personalized 
                nutrition guidance to the growing community of Indonesian runners and endurance athletes.
              </p>
              
              <div className="space-y-3">
                <h3 className="font-semibold">Why Indonesia?</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span>Growing running community with increasing participation in marathons</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span>Rich culinary diversity requiring localized nutrition guidance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span>Limited access to personalized nutrition services for athletes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span>Strong mobile-first culture perfect for our PWA approach</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <p className="text-sm font-medium text-primary">
                  With your continued support and feedback, we're confident we can launch into the 
                  Indonesian market soon and help thousands of athletes achieve their nutrition goals.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Get in Touch</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Have questions, suggestions, or want to learn more about our development process? 
                We'd love to hear from you!
              </p>
              <button 
                className="w-full px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors flex items-center justify-center gap-2"
                onClick={() => {
                  startTransition(() => {
                    window.open('mailto:hello@nutrisync.id', '_blank');
                  });
                }}
              >
                <MessageCircle className="h-4 w-4" />
                Contact Our Team
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
