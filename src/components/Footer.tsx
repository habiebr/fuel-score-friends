import { Link } from 'react-router-dom';
import { Scale, Shield, Mail, Heart } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">NS</span>
              </div>
              <span className="font-semibold">NutriSync</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your smart nutrition and training companion for marathon success.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/nutrition" className="hover:text-foreground transition-colors">
                  Nutrition Tracker
                </Link>
              </li>
              <li>
                <Link to="/goals" className="hover:text-foreground transition-colors">
                  Training Goals
                </Link>
              </li>
              <li>
                <Link to="/meal-plan" className="hover:text-foreground transition-colors">
                  AI Meal Planner
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link 
                  to="/terms-of-service" 
                  className="hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <Scale className="h-3 w-3" />
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link 
                  to="/privacy-policy" 
                  className="hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <Shield className="h-3 w-3" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/settings" className="hover:text-foreground transition-colors">
                  Cookie Settings
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a 
                  href="mailto:support@nutrisync.app" 
                  className="hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <Mail className="h-3 w-3" />
                  support@nutrisync.app
                </a>
              </li>
              <li>
                <Link to="/settings" className="hover:text-foreground transition-colors">
                  Account Settings
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-foreground transition-colors">
                  Profile
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {currentYear} NutriSync. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> in Melbourne, Australia
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
