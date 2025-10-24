import { useState, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Bug, Send, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BetaTestingReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BetaTestingReportDialog({ open, onOpenChange }: BetaTestingReportDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    subject: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category || !formData.subject || !formData.description) {
      toast({
        title: t('common.error'),
        description: 'Semua field wajib diisi',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    try {
      // Get user info
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create beta report entry
      const { error } = await supabase
        .from('beta_reports')
        .insert({
          user_id: user?.id || 'anonymous',
          category: formData.category,
          subject: formData.subject,
          description: formData.description,
          user_agent: navigator.userAgent,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error submitting beta report:', error);
        throw error;
      }

      toast({
        title: t('betaTesting.reportDialog.success'),
        description: 'Feedback Anda sangat berharga untuk pengembangan NutriSync!',
      });

      // Reset form
      setFormData({
        category: '',
        subject: '',
        description: '',
      });

      startTransition(() => onOpenChange(false));
    } catch (error) {
      console.error('Error submitting beta report:', error);
      toast({
        title: t('common.error'),
        description: t('betaTesting.reportDialog.error'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-primary" />
            {t('betaTesting.reportDialog.title')}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('betaTesting.reportDialog.description')}
          </p>

          <div className="space-y-2">
            <Label htmlFor="category">{t('betaTesting.reportDialog.category')}</Label>
            <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">{t('betaTesting.reportDialog.categoryOptions.bug')}</SelectItem>
                <SelectItem value="feature">{t('betaTesting.reportDialog.categoryOptions.feature')}</SelectItem>
                <SelectItem value="ui">{t('betaTesting.reportDialog.categoryOptions.ui')}</SelectItem>
                <SelectItem value="performance">{t('betaTesting.reportDialog.categoryOptions.performance')}</SelectItem>
                <SelectItem value="other">{t('betaTesting.reportDialog.categoryOptions.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">{t('betaTesting.reportDialog.subject')}</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => handleInputChange('subject', e.target.value)}
              placeholder={t('betaTesting.reportDialog.subjectPlaceholder')}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('betaTesting.reportDialog.descriptionLabel')}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder={t('betaTesting.reportDialog.descriptionPlaceholder')}
              rows={4}
              maxLength={1000}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => startTransition(() => onOpenChange(false))}
              className="flex-1"
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading}
            >
              <Send className="h-4 w-4 mr-2" />
              {loading ? t('betaTesting.reportDialog.submitting') : t('betaTesting.reportDialog.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
