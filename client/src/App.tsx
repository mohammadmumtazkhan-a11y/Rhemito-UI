import React, { Component, ErrorInfo, ReactNode } from "react";
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
import Payments from "@/pages/Payments";
import Senders from "@/pages/Senders";
import SenderDetail from "@/pages/SenderDetail";
import PayoutAccounts from "@/pages/PayoutAccounts";
import SendMoney from "@/pages/SendMoney";
import BonusAndDiscounts from "@/pages/BonusAndDiscounts";
import Marketing from "@/pages/Marketing";
import GroupPayDashboard from "@/pages/GroupPay/GroupPayDashboard";
import CreateCampaign from "@/pages/GroupPay/CreateCampaign";
import CampaignDetails from "@/pages/GroupPay/CampaignDetails";
import ContributorView from "@/pages/GroupPay/ContributorView";
import NotFound from "@/pages/not-found";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 text-red-900 border border-red-200 rounded m-4">
          <h1 className="text-xl font-bold mb-2">Something went wrong.</h1>
          <pre className="text-sm overflow-auto max-w-full bg-white p-2 rounded border border-red-100">
            {this.state.error?.toString()}
            <br />
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/request-payment" component={RequestPayment} />
      <Route path="/send-invoice" component={SendInvoice} />
      <Route path="/show-qr-code" component={ShowQRCode} />
      <Route path="/payments" component={Payments} />
      <Route path="/send-money" component={SendMoney} />
      <Route path="/senders" component={Senders} />
      <Route path="/senders/:email" component={SenderDetail} />
      <Route path="/payout-accounts" component={PayoutAccounts} />
      <Route path="/pay/:id" component={SenderView} />
      <Route path="/bonus-discounts" component={BonusAndDiscounts} />
      <Route path="/marketing" component={Marketing} />
      <Route path="/group-pay" component={GroupPayDashboard} />
      <Route path="/group-pay/create" component={CreateCampaign} />
      <Route path="/group-pay/:id" component={CampaignDetails} />
      <Route path="/contribute/:campaignId" component={ContributorView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
