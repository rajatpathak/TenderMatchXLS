import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ReanalyzeProgress {
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
  estimatedTimeRemaining: number;
  message: string;
}

interface ReanalyzeStatus {
  isRunning: boolean;
  status: 'idle' | 'running' | 'complete' | 'error';
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
  message: string;
}

export function useReanalyzeProgress() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<ReanalyzeProgress>({
    total: 0,
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    estimatedTimeRemaining: 0,
    message: '',
  });

  const { data: status } = useQuery<ReanalyzeStatus>({
    queryKey: ['/api/reanalyze-status'],
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.isRunning ? 2000 : false;
    },
  });

  const isRunning = status?.isRunning || false;

  useEffect(() => {
    if (!isRunning) return;

    const eventSource = new EventSource('/api/reanalyze-progress');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress({
          total: data.total || 0,
          processed: data.processed || 0,
          updated: data.updated || 0,
          skipped: data.skipped || 0,
          errors: data.errors || 0,
          estimatedTimeRemaining: data.estimatedTimeRemaining || 0,
          message: data.message || '',
        });

        if (data.type === 'complete' || data.type === 'error') {
          queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
          queryClient.invalidateQueries({ queryKey: ['/api/tenders'] });
          queryClient.invalidateQueries({ queryKey: ['/api/reanalyze-status'] });
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isRunning, queryClient]);

  const startReanalyze = useCallback(async () => {
    try {
      const response = await fetch('/api/tenders/reanalyze', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to start re-analyze');
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/reanalyze-status'] });
      return true;
    } catch (error) {
      console.error('Error starting re-analyze:', error);
      return false;
    }
  }, [queryClient]);

  return {
    progress,
    isRunning,
    status: status?.status || 'idle',
    startReanalyze,
  };
}
