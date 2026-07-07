import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppLayout } from '@/components/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Calculator from '@/pages/Calculator';
import PackingListManager from '@/pages/PackingList';
import Tracker from '@/pages/Tracker';
import { seedIfNeeded } from '@/lib/mockData';

// Seed before React initializes any state so hooks read data on first render
seedIfNeeded();

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/calculator" component={Calculator} />
        <Route path="/packing" component={PackingListManager} />
        <Route path="/tracker" component={Tracker} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
