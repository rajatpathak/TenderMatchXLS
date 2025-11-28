import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  Filter, 
  TrendingUp,
  Shield,
  Zap,
  LogIn,
  Loader2
} from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        setLocation("/dashboard");
      } else {
        const error = await response.json();
        toast({
          title: "Login Failed",
          description: error.message || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: "Unable to connect to server",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: FileSpreadsheet,
      title: "Excel Upload",
      description: "Upload your tender Excel files with Gem & Non-Gem sheets for instant analysis"
    },
    {
      icon: CheckCircle2,
      title: "Smart Matching",
      description: "Automatic eligibility matching against your company criteria"
    },
    {
      icon: Filter,
      title: "Advanced Filtering",
      description: "Filter by match percentage, budget, EMD, dates, and tender type"
    },
    {
      icon: TrendingUp,
      title: "Corrigendum Tracking",
      description: "Automatic detection of changes in updated tenders"
    },
    {
      icon: Shield,
      title: "MSME Recognition",
      description: "Identify tenders with turnover exemptions for MSMEs and Startups"
    },
    {
      icon: Zap,
      title: "Instant Tags",
      description: "Auto-generated tags for Manpower, IT, Software, and more"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground">TenderMatch</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main>
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <Zap className="w-4 h-4" />
                  Save hours of manual tender filtering
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
                  Smart Tender Eligibility
                  <span className="text-primary"> Analyzer</span>
                </h1>
                <p className="text-lg text-muted-foreground mb-8">
                  Upload your tender Excel files and instantly find opportunities that match your company's criteria. 
                  No more manual filtering through hundreds of tenders.
                </p>
              </div>

              <Card className="w-full max-w-md mx-auto">
                <CardHeader className="text-center">
                  <CardTitle className="flex items-center justify-center gap-2">
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </CardTitle>
                  <CardDescription>
                    Enter your credentials to access the dashboard
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter username"
                        required
                        data-testid="input-username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        required
                        data-testid="input-password"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={isLoading}
                      data-testid="button-login"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4 mr-2" />
                          Sign In
                        </>
                      )}
                    </Button>
                  </form>
                  

                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-card/50">
          <div className="container mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Everything You Need
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Powerful features designed to streamline your tender analysis workflow
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="hover-elevate">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-medium text-foreground">TenderMatch</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Automate your tender filtering process
          </p>
        </div>
      </footer>
    </div>
  );
}
