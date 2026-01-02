import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useZgloszoneIssues() {
  const [hasZgloszoneIssues, setHasZgloszoneIssues] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkZgloszoneIssues = async () => {
      try {
        // Check for issues with status 'reported' (displayed as 'Zgłoszone' in UI)
        const { data, error } = await supabase
          .from('issues')
          .select('id')
          .eq('status', 'reported')
          .limit(1);

        if (error) throw error;

        setHasZgloszoneIssues((data?.length || 0) > 0);
      } catch (error) {
        console.error('Error checking reported issues:', error);
        setHasZgloszoneIssues(false);
      } finally {
        setLoading(false);
      }
    };

    checkZgloszoneIssues();

    // Set up realtime subscription
    // Listen to all changes on issues table and recheck
    const channel = supabase
      .channel('reported-issues-channel')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'issues'
        },
        () => {
          checkZgloszoneIssues();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { hasZgloszoneIssues, loading };
}

