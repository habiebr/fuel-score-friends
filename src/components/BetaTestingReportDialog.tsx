import { useState, startTransition } from 'react';
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
        title: 'Error',
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
        title: 'Laporan berhasil dikirim!',
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
        title: 'Error',
        description: 'Gagal mengirim laporan. Silakan coba lagi.',
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
      <DialogContent className="w-[95vw] max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Bug className="h-5 w-5 text-primary" />
            Laporan Beta Testing
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Bantu kami meningkatkan NutriSync dengan melaporkan masalah atau memberikan saran Anda.
          </p>

          <div className="space-y-1">
            <Label htmlFor="category" className="text-sm font-medium">Kategori</Label>
            <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug/Laporan Masalah</SelectItem>
                <SelectItem value="feature">Permintaan Fitur</SelectItem>
                <SelectItem value="ui">Masalah UI/UX</SelectItem>
                <SelectItem value="performance">Masalah Performa</SelectItem>
                <SelectItem value="other">Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="subject" className="text-sm font-medium">Subjek</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => handleInputChange('subject', e.target.value)}
              placeholder="Ringkasan singkat masalah atau saran"
              maxLength={100}
              className="h-10"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description" className="text-sm font-medium">Deskripsi</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Jelaskan secara detail masalah yang Anda alami atau saran yang ingin Anda berikan..."
              rows={3}
              maxLength={1000}
              className="resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => startTransition(() => onOpenChange(false))}
              className="flex-1 h-10"
              disabled={loading}
            >
              <X className="h-4 w-4 mr-1" />
              Batal
            </Button>
            <Button
              type="submit"
              className="flex-1 h-10"
              disabled={loading}
            >
              <Send className="h-4 w-4 mr-1" />
              {loading ? 'Mengirim...' : 'Kirim Laporan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
