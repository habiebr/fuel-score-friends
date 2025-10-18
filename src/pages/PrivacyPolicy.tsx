import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Database, Eye, Cookie, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Privacy Policy</h1>
                <p className="text-sm text-muted-foreground">Last updated: October 14, 2025</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-none">
        {/* Introduction */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Your Privacy Matters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              At NutriSync, we take your privacy seriously. This Privacy Policy explains how we collect, 
              use, disclose, and safeguard your information when you use our nutrition and fitness tracking application.
            </p>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <p className="text-sm font-medium">
                We are committed to protecting your personal health and fitness data with industry-standard 
                security measures and transparent practices.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Information We Collect */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              1. Information We Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-2">Personal Information:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Name, email address, and profile information</li>
                <li>Age, gender, height, weight, and body measurements</li>
                <li>Fitness level, goals, and training preferences</li>
                <li>Timezone and location data (for meal timing recommendations)</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-2">Health and Fitness Data:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Food logs (meals, calories, macronutrients, meal times)</li>
                <li>Training activities (runs, workouts, duration, distance, intensity)</li>
                <li>Wearable device data (steps, heart rate, calories burned, sleep data)</li>
                <li>Race goals and marathon event information</li>
                <li>Daily nutrition and training scores</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">Third-Party Integration Data:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Apple Health data (with your permission)</li>
                <li>Google Fit data (with your permission)</li>
                <li>Strava activities (with your permission)</li>
                <li>Garmin Connect data (with your permission)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">AI Processing Data:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Fitness screenshots uploaded for AI analysis</li>
                <li>AI-generated meal plans and recommendations</li>
                <li>Chat interactions with AI meal planning assistant</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">Technical Data:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Device information (type, operating system, browser)</li>
                <li>IP address and approximate location</li>
                <li>App usage data and analytics</li>
                <li>Error logs and crash reports</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* How We Use Your Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">2. How We Use Your Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We use your information to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Provide Core Services:</strong> Track nutrition, analyze training, calculate daily scores</li>
              <li><strong>Personalize Experience:</strong> Generate customized meal plans and training recommendations</li>
              <li><strong>AI Features:</strong> Process fitness screenshots, create meal suggestions, provide nutrition insights</li>
              <li><strong>Sync Data:</strong> Integrate with Apple Health, Google Fit, Strava, and Garmin</li>
              <li><strong>Improve Service:</strong> Analyze usage patterns, fix bugs, develop new features</li>
              <li><strong>Communication:</strong> Send important updates, notifications, and support responses</li>
              <li><strong>Security:</strong> Detect fraud, prevent abuse, and protect user data</li>
              <li><strong>Legal Compliance:</strong> Comply with applicable laws and regulations</li>
            </ul>
          </CardContent>
        </Card>

        {/* Third-Party Services */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">3. Third-Party Services and Data Sharing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-2">AI Service Providers:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>OpenAI (GPT-4 Vision):</strong> Processes fitness screenshots and generates meal plans</li>
                <li><strong>Google Gemini:</strong> Alternative AI provider for text generation</li>
                <li>Data sent to AI providers is anonymized where possible</li>
                <li>AI providers have their own privacy policies and data handling practices</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">Wearable Device Platforms:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Apple Health:</strong> Data synced with your explicit permission via HealthKit</li>
                <li><strong>Google Fit:</strong> Activity and health data accessed via Google Fit API</li>
                <li><strong>Strava:</strong> Training activities imported via Strava OAuth</li>
                <li><strong>Garmin Connect:</strong> Workout data synced via Garmin API</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">Infrastructure and Analytics:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Supabase:</strong> Database and authentication services (SOC 2 compliant)</li>
                <li><strong>Cloudflare:</strong> CDN and edge computing for performance</li>
                <li><strong>Analytics Tools:</strong> Aggregated, anonymized usage statistics</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
              <p className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                We DO NOT sell your personal data to third parties
              </p>
              <p className="text-blue-700 dark:text-blue-400">
                Your health and fitness data is never sold, rented, or traded to advertisers or data brokers. 
                We only share data with service providers necessary to operate the app, and they are 
                contractually bound to protect your privacy.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Data Security */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              4. Data Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We implement industry-standard security measures to protect your data:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Encryption:</strong> All data transmitted over HTTPS/TLS encryption</li>
              <li><strong>Database Security:</strong> Encrypted at rest with row-level security policies</li>
              <li><strong>Authentication:</strong> Secure OAuth 2.0 and JWT token-based authentication</li>
              <li><strong>Access Controls:</strong> Role-based permissions and principle of least privilege</li>
              <li><strong>Regular Audits:</strong> Security assessments and vulnerability scanning</li>
              <li><strong>Data Backups:</strong> Regular encrypted backups with disaster recovery plans</li>
            </ul>
            <p className="mt-3">
              However, no method of transmission over the internet is 100% secure. While we strive to 
              protect your data, we cannot guarantee absolute security.
            </p>
          </CardContent>
        </Card>

        {/* Your Rights */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              5. Your Privacy Rights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Depending on your location, you may have the following rights:</p>
            
            <div>
              <h4 className="font-semibold text-foreground mb-2">Access and Portability:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Request a copy of all personal data we hold about you</li>
                <li>Export your data in a machine-readable format (JSON, CSV)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">Correction and Update:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Correct inaccurate or incomplete data</li>
                <li>Update your profile information at any time</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">Deletion (Right to be Forgotten):</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Request permanent deletion of your account and all associated data</li>
                <li>Data will be deleted within 30 days of request (subject to legal retention requirements)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">Opt-Out and Restrict Processing:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Disconnect third-party integrations at any time</li>
                <li>Opt-out of AI features (screenshot analysis, meal planning)</li>
                <li>Unsubscribe from marketing emails (if applicable)</li>
              </ul>
            </div>

            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4 mt-4">
              <p className="font-semibold text-green-800 dark:text-green-300 mb-2">
                How to Exercise Your Rights:
              </p>
              <p className="text-green-700 dark:text-green-400">
                Email us at <strong>privacy@nutrisync.app</strong> or use the data management tools 
                in your account settings. We will respond within 30 days.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">6. Data Retention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We retain your data for as long as:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Your account is active</li>
              <li>Needed to provide you services</li>
              <li>Required by law (e.g., tax records, legal disputes)</li>
            </ul>
            <p className="mt-3">Upon account deletion:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Personal data is permanently deleted within 30 days</li>
              <li>Anonymized, aggregated data may be retained for analytics</li>
              <li>Backups are securely purged within 90 days</li>
            </ul>
          </CardContent>
        </Card>

        {/* Cookies */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cookie className="h-5 w-5 text-primary" />
              7. Cookies and Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We use cookies and similar technologies to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Essential Cookies:</strong> Maintain your login session and preferences</li>
              <li><strong>Analytics Cookies:</strong> Understand how you use the app (anonymized)</li>
              <li><strong>Performance Cookies:</strong> Improve app speed and functionality</li>
            </ul>
            <p className="mt-3">
              You can control cookies through your browser settings. Note that disabling essential cookies 
              may affect app functionality.
            </p>
          </CardContent>
        </Card>

        {/* Children's Privacy */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">8. Children's Privacy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              NutriSync is not intended for children under 18 years of age. We do not knowingly collect 
              personal information from children under 18.
            </p>
            <p>
              If you are a parent or guardian and believe your child has provided us with personal information, 
              please contact us immediately at <strong>privacy@nutrisync.app</strong> and we will delete 
              the information.
            </p>
          </CardContent>
        </Card>

        {/* International Data Transfers */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">9. International Data Transfers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Your data may be transferred to and processed in countries other than your country of residence, 
              including the United States (AI providers) and other regions where our service providers operate.
            </p>
            <p>
              We ensure appropriate safeguards are in place, including:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Standard contractual clauses approved by relevant authorities</li>
              <li>Privacy Shield frameworks (where applicable)</li>
              <li>Adequacy decisions for cross-border data transfers</li>
            </ul>
          </CardContent>
        </Card>

        {/* Changes to Privacy Policy */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">10. Changes to This Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of changes by:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Posting the new Privacy Policy on this page</li>
              <li>Updating the "Last updated" date</li>
              <li>Sending an email notification for material changes</li>
              <li>Displaying an in-app notification</li>
            </ul>
            <p className="mt-3">
              Your continued use after changes constitutes acceptance of the updated Privacy Policy.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              11. Contact Us
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              If you have questions about this Privacy Policy or how we handle your data, please contact:
            </p>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p><strong>Privacy Officer:</strong> privacy@nutrisync.app</p>
              <p><strong>General Support:</strong> support@nutrisync.app</p>
              <p><strong>Data Protection:</strong> dpo@nutrisync.app</p>
              <p><strong>Address:</strong> Melbourne, Victoria, Australia</p>
            </div>
          </CardContent>
        </Card>

        {/* GDPR/CCPA Notice */}
        <Card className="mb-8 bg-primary/5 border-primary/20">
          <CardContent className="pt-6 space-y-3 text-sm">
            <p className="font-semibold">GDPR & CCPA Compliance:</p>
            <p className="text-muted-foreground">
              NutriSync is committed to compliance with the EU General Data Protection Regulation (GDPR) 
              and California Consumer Privacy Act (CCPA). EU and California residents have additional rights 
              regarding their personal data. Contact us for more information about exercising these rights.
            </p>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        {/* Footer Navigation */}
        <div className="flex justify-center gap-4 pb-8">
          <Button variant="outline" onClick={() => navigate('/terms-of-service')}>
            Terms of Service
          </Button>
          <Button variant="outline" onClick={() => navigate('/settings')}>
            Privacy Settings
          </Button>
          <Button onClick={() => navigate(-1)}>
            Back to App
          </Button>
        </div>
      </div>
    </div>
  );
}
