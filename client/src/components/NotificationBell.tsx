import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Clock, User, Calendar, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import type { PresentationWithDetails } from "@shared/schema";

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

function formatTime(time: string | null): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: presentations = [] } = useQuery<PresentationWithDetails[]>({
    queryKey: ['/api/presentations/today'],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const activePresentations = useMemo(() => {
    return presentations.filter(p => !isPresentationExpired(p));
  }, [presentations]);

  const count = activePresentations.length;

  if (count === 0) {
    return null;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-presentation-alerts"
        >
          <Bell className="h-5 w-5" />
          <Badge 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground"
          >
            {count}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Today's Presentations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {activePresentations.map((presentation) => (
            <div
              key={presentation.id}
              className="p-3 hover-elevate cursor-pointer border-b last:border-b-0"
              onClick={() => setIsOpen(false)}
            >
              <Link href="/presentations">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm line-clamp-2">
                      {presentation.referenceId}
                    </p>
                    {presentation.scheduledTime && (
                      <Badge variant="outline" className="shrink-0 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(presentation.scheduledTime)}
                      </Badge>
                    )}
                  </div>
                  
                  {presentation.tender?.title && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {presentation.tender.title}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{presentation.assignee?.fullName || 'Unassigned'}</span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Link href="/presentations">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setIsOpen(false)}
              data-testid="button-view-all-presentations"
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              View All Presentations
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
