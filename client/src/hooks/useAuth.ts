import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export interface SessionUser extends User {
  role?: 'admin' | 'manager' | 'bidder';
  teamMemberId?: number;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<SessionUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
