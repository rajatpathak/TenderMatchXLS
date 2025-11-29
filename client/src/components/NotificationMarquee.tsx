import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Calendar, FileQuestion, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { PresentationWithDetails, ClarificationWithDetails } from "@shared/schema";

function isPresentationExpired(presentation: PresentationWithDetails): boolean {
  const now = new Date();
  const presentationDate = new Date(presentation.scheduledDate);
  
  const todayStr = now.toISOString().split('T')[0];
  const presentationDateStr = presentationDate.toISOString().split('T')[0];
  
  if (presentationDateStr !== todayStr) {
    return true;
  }
  
  if (presentation.scheduledTime) {
    const [hours, minutes] = presentation.scheduledTime.split(':').map(Number);
    const presentationTime = new Date();
    presentationTime.setHours(hours, minutes, 0, 0);
    
    return now > presentationTime;
  }
  
  return false;
}

function isClarificationExpired(clarification: ClarificationWithDetails): boolean {
  const now = new Date();
  
  if (!clarification.submitDeadlineDate) {
    return true;
  }
  
  const deadlineDate = new Date(clarification.submitDeadlineDate);
  const todayStr = now.toISOString().split('T')[0];
  const deadlineDateStr = deadlineDate.toISOString().split('T')[0];
  
  if (deadlineDateStr !== todayStr) {
    return true;
  }
  
  if (clarification.submitDeadlineTime) {
    const [hours, minutes] = clarification.submitDeadlineTime.split(':').map(Number);
    const deadlineTime = new Date();
    deadlineTime.setHours(hours, minutes, 0, 0);
    
    return now > deadlineTime;
  }
  
  return false;
}

function formatTime(time: string | null): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

interface NotificationItem {
  id: string;
  type: 'presentation' | 'clarification';
  title: string;
  time: string;
  link: string;
}

export function NotificationMarquee() {
  const { data: presentations = [] } = useQuery<PresentationWithDetails[]>({
    queryKey: ['/api/presentations/today'],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: clarifications = [] } = useQuery<ClarificationWithDetails[]>({
    queryKey: ['/api/clarifications/today'],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const notifications = useMemo(() => {
    const items: NotificationItem[] = [];
    
    presentations
      .filter(p => !isPresentationExpired(p))
      .forEach(p => {
        const tenderTitle = p.tender?.title;
        items.push({
          id: `pres-${p.id}`,
          type: 'presentation',
          title: `Presentation: ${p.referenceId}${tenderTitle ? ` - ${tenderTitle.slice(0, 40)}${tenderTitle.length > 40 ? '...' : ''}` : ''}`,
          time: p.scheduledTime ? formatTime(p.scheduledTime) : 'Today',
          link: '/presentations',
        });
      });
    
    clarifications
      .filter(c => !isClarificationExpired(c))
      .forEach(c => {
        const tenderTitle = c.tender?.title;
        items.push({
          id: `clar-${c.id}`,
          type: 'clarification',
          title: `Clarification Due: ${c.referenceId}${tenderTitle ? ` - ${tenderTitle.slice(0, 40)}${tenderTitle.length > 40 ? '...' : ''}` : ''}`,
          time: c.submitDeadlineTime ? formatTime(c.submitDeadlineTime) : 'Today',
          link: '/clarifications',
        });
      });
    
    return items;
  }, [presentations, clarifications]);

  if (notifications.length === 0) {
    return null;
  }

  const marqueeContent = notifications.map(n => (
    <span key={n.id} className="inline-flex items-center gap-2 mx-8">
      {n.type === 'presentation' ? (
        <Calendar className="h-4 w-4 shrink-0" />
      ) : (
        <FileQuestion className="h-4 w-4 shrink-0" />
      )}
      <span className="font-medium">{n.title}</span>
      <span className="text-amber-800 dark:text-amber-200">@ {n.time}</span>
    </span>
  ));

  return (
    <div 
      className="bg-amber-400 dark:bg-amber-500 text-amber-900 dark:text-amber-950 py-1.5 overflow-hidden shrink-0"
      data-testid="notification-marquee"
    >
      <div className="flex items-center">
        <div className="flex items-center gap-2 px-3 shrink-0 border-r border-amber-500 dark:border-amber-600">
          <Bell className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">{notifications.length} Alert{notifications.length > 1 ? 's' : ''}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="marquee-container">
            <div className="marquee-content">
              {marqueeContent}
              {marqueeContent}
            </div>
          </div>
        </div>
        <div className="px-3 shrink-0 border-l border-amber-500 dark:border-amber-600">
          <Link href="/presentations">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-xs bg-amber-500/50 dark:bg-amber-600/50 text-amber-900 dark:text-amber-950 border-0"
              data-testid="button-view-all-notifications"
            >
              View All
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
