// @ts-nocheck
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export function MarketingReceiptListener() {
  const { toast } = useToast();
  const { user, profile } = useAuth();

  useEffect(() => {
    // Only listen if the user is an admin
    if (!user || (profile as any)?.role !== 'admin') return;

    const channel = supabase.channel('marketing-receipts', {
      config: {
        broadcast: { ack: false },
      },
    });

    channel
      .on(
        'broadcast',
        { event: 'notification_received' },
        (payload) => {
          const { user_email, notification_title } = payload.payload;
          
          toast({
            title: "👀 Notificação Visualizada",
            description: `O cliente ${user_email || 'Desconhecido'} acabou de receber a oferta "${notification_title}".`,
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, (profile as any)?.role]);

  return null;
}
