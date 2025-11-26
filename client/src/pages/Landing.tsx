import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  Filter, 
  TrendingUp,
  Shield,
  Zap,
  ArrowRight
} from "lucide-react";

export default function Landing() {
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
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button 
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-login"
            >
              Sign In
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="py-20 px-4">
          <div className="container mx-auto text-center max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Save hours of manual tender filtering
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Smart Tender Eligibility
              <span className="text-primary"> Analyzer</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Upload your tender Excel files and instantly find opportunities that match your company's criteria. 
              No more manual filtering through hundreds of tenders.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => window.location.href = "/api/login"}
                data-testid="button-get-started"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                data-testid="button-learn-more"
              >
                Learn More
              </Button>
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

        <section className="py-16 px-4">
          <div className="container mx-auto">
            <Card className="bg-primary text-primary-foreground overflow-hidden">
              <CardContent className="p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-2">
                    Ready to save time?
                  </h2>
                  <p className="text-primary-foreground/80">
                    Start analyzing your tender opportunities today.
                  </p>
                </div>
                <Button 
                  size="lg" 
                  variant="secondary"
                  onClick={() => window.location.href = "/api/login"}
                  data-testid="button-cta-login"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
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
