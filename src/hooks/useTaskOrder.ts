import { supabase } from '@/integrations/supabase/client';

export function useTaskOrder() {
  const reorder = async (orderedTaskIds: string[]): Promise<void> => {
    await Promise.all(
      orderedTaskIds.map((id, index) =>
        supabase.from('tasks').update({ display_order: index + 1 }).eq('id', id)
      )
    );
  };

  return { reorder };
}
