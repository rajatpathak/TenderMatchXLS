import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Clock, User, Calendar, ExternalLink, AlertTriangle, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

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

  const activePresentations = useMemo(() => {
    return presentations.filter(p => !isPresentationExpired(p));
  }, [presentations]);

  const activeClarifications = useMemo(() => {
    return clarifications.filter(c => !isClarificationExpired(c));
  }, [clarifications]);

  const presentationCount = activePresentations.length;
  const clarificationCount = activeClarifications.length;
  const totalCount = presentationCount + clarificationCount;

  if (totalCount === 0) {
    return null;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          <Badge 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground"
          >
            {totalCount}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Today's Reminders
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all" className="text-xs">
              All ({totalCount})
            </TabsTrigger>
            <TabsTrigger value="presentations" className="text-xs">
              Presentations ({presentationCount})
            </TabsTrigger>
            <TabsTrigger value="clarifications" className="text-xs">
              Clarifications ({clarificationCount})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-0">
            <div className="max-h-80 overflow-y-auto">
              {totalCount === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">
                  No reminders for today
                </p>
              ) : (
                <>
                  {activePresentations.map((presentation) => (
                    <PresentationNotificationItem
                      key={`presentation-${presentation.id}`}
                      presentation={presentation}
                      onClose={() => setIsOpen(false)}
                    />
                  ))}
                  {activeClarifications.map((clarification) => (
                    <ClarificationNotificationItem
                      key={`clarification-${clarification.id}`}
                      clarification={clarification}
                      onClose={() => setIsOpen(false)}
                    />
                  ))}
                </>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="presentations" className="mt-0">
            <div className="max-h-80 overflow-y-auto">
              {activePresentations.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">
                  No presentations scheduled for today
                </p>
              ) : (
                activePresentations.map((presentation) => (
                  <PresentationNotificationItem
                    key={presentation.id}
                    presentation={presentation}
                    onClose={() => setIsOpen(false)}
                  />
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="clarifications" className="mt-0">
            <div className="max-h-80 overflow-y-auto">
              {activeClarifications.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">
                  No clarification deadlines for today
                </p>
              ) : (
                activeClarifications.map((clarification) => (
                  <ClarificationNotificationItem
                    key={clarification.id}
                    clarification={clarification}
                    onClose={() => setIsOpen(false)}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        <DropdownMenuSeparator />
        <div className="p-2 flex gap-2">
          <Link href="/presentations" className="flex-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setIsOpen(false)}
              data-testid="button-view-all-presentations"
            >
              <Calendar className="h-3 w-3 mr-2" />
              Presentations
            </Button>
          </Link>
          <Link href="/clarifications" className="flex-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setIsOpen(false)}
              data-testid="button-view-all-clarifications"
            >
              <FileQuestion className="h-3 w-3 mr-2" />
              Clarifications
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PresentationNotificationItem({ 
  presentation, 
  onClose 
}: { 
  presentation: PresentationWithDetails; 
  onClose: () => void;
}) {
  return (
    <div
      className="p-3 hover-elevate cursor-pointer border-b last:border-b-0"
      onClick={onClose}
    >
      <Link href="/presentations">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
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
                <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                  {presentation.tender.title}
                </p>
              )}
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <User className="h-3 w-3" />
                <span>{presentation.assignee?.fullName || 'Unassigned'}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

function ClarificationNotificationItem({ 
  clarification, 
  onClose 
}: { 
  clarification: ClarificationWithDetails; 
  onClose: () => void;
}) {
  return (
    <div
      className="p-3 hover-elevate cursor-pointer border-b last:border-b-0"
      onClick={onClose}
    >
      <Link href="/clarifications">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm line-clamp-2">
                  {clarification.referenceId}
                </p>
                {clarification.submitDeadlineTime && (
                  <Badge variant="destructive" className="shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(clarification.submitDeadlineTime)}
                  </Badge>
                )}
              </div>
              
              {clarification.clarificationDetails && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                  {clarification.clarificationDetails}
                </p>
              )}
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <User className="h-3 w-3" />
                <span>{clarification.assignee?.fullName || 'Unassigned'}</span>
                <Badge variant="outline" className="text-xs">Deadline Today</Badge>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
