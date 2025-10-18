import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Scale, Shield, FileText, Users, AlertTriangle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function TermsOfService() {
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
              <Scale className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Terms of Service</h1>
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
              <FileText className="h-5 w-5 text-primary" />
              Welcome to NutriSync
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              These Terms of Service ("Terms") govern your access to and use of NutriSync, 
              a nutrition and fitness tracking application designed specifically for endurance athletes 
              and marathon runners. By accessing or using NutriSync, you agree to be bound by these Terms.
            </p>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <p className="text-sm font-medium">
                Please read these terms carefully before using our service. If you do not agree to these terms, 
                please do not use NutriSync.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Important:</strong> NutriSync is an AI-based product that uses artificial intelligence for nutrition analysis, meal planning, and fitness tracking. By using our service, you acknowledge and agree to the AI-powered features described in these terms.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 1. Acceptance of Terms */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">1. Acceptance of Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              By creating an account, accessing, or using NutriSync in any way, you acknowledge that you have read, 
              understood, and agree to be bound by these Terms and our Privacy Policy.
            </p>
            <p>
              If you are using NutriSync on behalf of an organization, you represent and warrant that you have the 
              authority to bind that organization to these Terms.
            </p>
          </CardContent>
        </Card>

        {/* 2. Description of Service */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">2. Description of Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>NutriSync provides the following services:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Nutrition tracking and analysis for endurance athletes</li>
              <li>Smart meal planning and recommendations</li>
              <li>Training activity logging and monitoring</li>
              <li>Integration with wearable devices (Apple Health, Google Fit, Strava, Garmin)</li>
              <li>Fitness screenshot analysis powered by AI</li>
              <li>Unified daily scoring system for nutrition and training</li>
              <li>Marathon race goal tracking and preparation tools</li>
            </ul>
            <p className="mt-3">
              We reserve the right to modify, suspend, or discontinue any part of the service at any time 
              with or without notice.
            </p>
          </CardContent>
        </Card>

        {/* 3. User Accounts */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              3. User Accounts and Responsibilities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-2">Account Creation:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>You must provide accurate, current, and complete information during registration</li>
                <li>You must be at least 18 years old to use NutriSync</li>
                <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                <li>You are responsible for all activities that occur under your account</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Account Security:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Notify us immediately of any unauthorized access or security breach</li>
                <li>Use a strong, unique password for your account</li>
                <li>Do not share your account credentials with others</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 4. Health and Medical Disclaimer */}
        <Card className="mb-6 border-orange-500/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              4. Health and Medical Disclaimer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-4">
              <p className="font-semibold text-orange-800 dark:text-orange-300 mb-2">
                IMPORTANT: Please Read Carefully
              </p>
              <ul className="space-y-2 text-orange-700 dark:text-orange-400">
                <li>• NutriSync is NOT a substitute for professional medical advice, diagnosis, or treatment</li>
                <li>• Always consult with a qualified healthcare provider before starting any nutrition or training program</li>
                <li>• The information provided is for informational purposes only</li>
                <li>• We do not provide medical advice or recommendations</li>
              </ul>
            </div>
            <p>
              NutriSync provides general nutrition and fitness tracking tools. All recommendations, meal plans, 
              and training suggestions are generated based on algorithms and user input, not medical expertise.
            </p>
            <p>
              You should always consult with a registered dietitian, sports nutritionist, or physician before:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Making significant changes to your diet</li>
              <li>Starting or modifying a training program</li>
              <li>Using nutritional supplements</li>
              <li>If you have any pre-existing medical conditions</li>
            </ul>
          </CardContent>
        </Card>

        {/* 5. AI and Data Processing */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">5. AI Features and Data Processing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>NutriSync is an AI-based product that uses artificial intelligence and advanced algorithms for:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Fitness Screenshot Analysis:</strong> Extracting workout data from images using AI vision models</li>
              <li><strong>Meal Planning:</strong> Generating personalized meal recommendations based on your goals and preferences</li>
              <li><strong>Nutrition Scoring:</strong> Analyzing your daily nutrition intake and providing feedback</li>
            </ul>
            <p className="mt-3">
              By using these AI features, you acknowledge that:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>AI recommendations may not always be 100% accurate</li>
              <li>You should verify AI-extracted data for accuracy</li>
              <li>AI-generated meal plans should be reviewed by a nutrition professional if you have specific dietary needs</li>
              <li>Your data may be processed by third-party AI services (OpenAI, Google) as outlined in our Privacy Policy</li>
            </ul>
          </CardContent>
        </Card>

        {/* 6. Third-Party Integrations */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">6. Third-Party Integrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>NutriSync integrates with third-party services including:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Apple Health</li>
              <li>Google Fit</li>
              <li>Strava</li>
              <li>Garmin Connect</li>
            </ul>
            <p className="mt-3">
              By connecting these services, you agree to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Grant NutriSync access to relevant health and fitness data from these platforms</li>
              <li>Comply with the terms of service of each third-party platform</li>
              <li>Understand that we are not responsible for the accuracy or availability of third-party data</li>
              <li>Accept that third-party service interruptions may affect NutriSync functionality</li>
            </ul>
          </CardContent>
        </Card>

        {/* 7. User Content and Data */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">7. User Content and Data Ownership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-2">Your Data:</h4>
              <p>
                You retain ownership of all data you input into NutriSync, including food logs, training activities, 
                personal measurements, and goals. We do not claim ownership of your personal data.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">License to Use Your Data:</h4>
              <p>
                By using NutriSync, you grant us a limited, non-exclusive license to use your data to:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Provide and improve our services</li>
                <li>Generate personalized recommendations</li>
                <li>Create aggregated, anonymized analytics</li>
                <li>Train and improve our AI models (anonymized only)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Data Export and Deletion:</h4>
              <p>
                You may request to export or delete your data at any time by contacting support. 
                Data deletion is permanent and cannot be undone.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 8. Prohibited Uses */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              8. Prohibited Uses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>You agree NOT to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Use the service for any illegal or unauthorized purpose</li>
              <li>Violate any laws in your jurisdiction</li>
              <li>Upload malicious code, viruses, or harmful content</li>
              <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
              <li>Scrape, harvest, or collect data from the service using automated means</li>
              <li>Impersonate another person or entity</li>
              <li>Share or redistribute AI-generated content as your own professional advice</li>
              <li>Use the service to provide medical or nutritional advice to others commercially</li>
              <li>Reverse engineer, decompile, or disassemble any part of the service</li>
            </ul>
          </CardContent>
        </Card>

        {/* 9. Subscription and Payments */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">9. Subscription and Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-2">Free Tier:</h4>
              <p>
                NutriSync offers a free tier with limited features. We may modify or discontinue the free tier 
                at any time with reasonable notice.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Premium Subscriptions (Future):</h4>
              <p>
                If you subscribe to a premium plan:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Fees are billed in advance on a recurring basis (monthly or annually)</li>
                <li>Subscriptions automatically renew unless cancelled</li>
                <li>You may cancel at any time, but refunds are not provided for partial periods</li>
                <li>We reserve the right to change subscription prices with 30 days notice</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 10. Intellectual Property */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">10. Intellectual Property Rights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              NutriSync and its original content, features, and functionality are owned by NutriSync and are 
              protected by international copyright, trademark, patent, trade secret, and other intellectual 
              property laws.
            </p>
            <p>
              Our trademarks, logos, and service marks may not be used without prior written permission. 
              You may not copy, modify, distribute, sell, or lease any part of our service or software.
            </p>
          </CardContent>
        </Card>

        {/* 11. Limitation of Liability */}
        <Card className="mb-6 border-red-500/50">
          <CardHeader>
            <CardTitle className="text-lg text-red-600 dark:text-red-400">11. Limitation of Liability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-4">
              <p className="font-semibold text-red-800 dark:text-red-300 mb-2 uppercase">
                Important Legal Notice
              </p>
              <p className="text-red-700 dark:text-red-400">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, NUTRISYNC SHALL NOT BE LIABLE FOR ANY INDIRECT, 
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, 
                WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER 
                INTANGIBLE LOSSES.
              </p>
            </div>
            <p>
              We provide the service "AS IS" and "AS AVAILABLE" without warranties of any kind, either express 
              or implied, including but not limited to warranties of merchantability, fitness for a particular 
              purpose, or non-infringement.
            </p>
            <p>
              We do not warrant that:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>The service will be uninterrupted or error-free</li>
              <li>Defects will be corrected</li>
              <li>The service is free from viruses or harmful components</li>
              <li>Results from using the service will be accurate or reliable</li>
            </ul>
          </CardContent>
        </Card>

        {/* 12. Indemnification */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">12. Indemnification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              You agree to indemnify, defend, and hold harmless NutriSync, its officers, directors, employees, 
              and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) 
              arising from:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Your use or misuse of the service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of another party</li>
              <li>Any health issues arising from following AI-generated recommendations without professional consultation</li>
            </ul>
          </CardContent>
        </Card>

        {/* 13. Termination */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">13. Termination</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-2">By You:</h4>
              <p>
                You may terminate your account at any time by contacting support or using the account 
                deletion feature in the app.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">By Us:</h4>
              <p>
                We may suspend or terminate your account immediately, without prior notice, if you:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Violate these Terms</li>
                <li>Engage in fraudulent or illegal activities</li>
                <li>Cause harm to other users or the service</li>
                <li>Fail to pay fees (for premium accounts)</li>
              </ul>
            </div>
            <p className="mt-3">
              Upon termination, your right to use the service will immediately cease. We may delete your 
              data after account termination, subject to legal retention requirements.
            </p>
          </CardContent>
        </Card>

        {/* 14. Changes to Terms */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">14. Changes to These Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of any changes by:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Posting the new Terms on this page</li>
              <li>Updating the "Last updated" date at the top of this page</li>
              <li>Sending an email notification for material changes</li>
            </ul>
            <p className="mt-3">
              Your continued use of the service after any changes constitutes acceptance of the new Terms. 
              If you do not agree to the new Terms, you must stop using the service.
            </p>
          </CardContent>
        </Card>

        {/* 15. Governing Law */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">15. Governing Law and Dispute Resolution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of Australia 
              (Victoria), without regard to its conflict of law provisions.
            </p>
            <p>
              Any disputes arising from these Terms or your use of the service shall be resolved through:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Good faith negotiations between the parties</li>
              <li>If negotiations fail, binding arbitration in Melbourne, Victoria, Australia</li>
              <li>The prevailing party shall be entitled to recover reasonable attorney's fees</li>
            </ul>
          </CardContent>
        </Card>

        {/* 16. Contact Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              16. Contact Us
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p><strong>Email:</strong> legal@nutrisync.app</p>
              <p><strong>Support:</strong> support@nutrisync.app</p>
              <p><strong>Address:</strong> Melbourne, Victoria, Australia</p>
            </div>
          </CardContent>
        </Card>

        {/* Acceptance */}
        <Card className="mb-8 bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <p className="text-sm text-center text-muted-foreground">
              By using NutriSync, you acknowledge that you have read, understood, and agree to be bound by these 
              Terms of Service. If you do not agree to these terms, please discontinue use of the service immediately.
            </p>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        {/* Footer Navigation */}
        <div className="flex justify-center gap-4 pb-8">
          <Button variant="outline" onClick={() => navigate('/privacy-policy')}>
            Privacy Policy
          </Button>
          <Button variant="outline" onClick={() => navigate('/settings')}>
            Account Settings
          </Button>
          <Button onClick={() => navigate(-1)}>
            Back to App
          </Button>
        </div>
      </div>
    </div>
  );
}
