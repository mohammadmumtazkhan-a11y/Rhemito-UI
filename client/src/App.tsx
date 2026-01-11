import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import RequestPayment from "@/pages/RequestPayment";
import SendInvoice from "@/pages/SendInvoice";
import ShowQRCode from "@/pages/ShowQRCode";
import SenderView from "@/pages/SenderView";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/request-payment" component={RequestPayment} />
      <Route path="/send-invoice" component={SendInvoice} />
      <Route path="/show-qr-code" component={ShowQRCode} />
      <Route path="/pay/:id" component={SenderView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
