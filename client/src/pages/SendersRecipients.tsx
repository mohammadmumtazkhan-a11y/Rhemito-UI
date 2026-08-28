/**
 * Consolidated Senders & Recipients page (sidebar top-level entry).
 * Hosts the two former standalone pages as tabs — each panel keeps its own
 * search, table, modals and actions unchanged. Both panels stay mounted so
 * locally added records survive switching tabs within a session. The active
 * tab is deep-linkable via ?tab=senders|recipients.
 */

import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SendersPanel } from "@/components/contacts/SendersPanel";
import { RecipientsPanel } from "@/components/contacts/RecipientsPanel";
import { cn } from "@/lib/utils";

type PeopleTab = "senders" | "recipients";

const PEOPLE_TABS: { value: PeopleTab; label: string }[] = [
  { value: "senders", label: "Senders" },
  { value: "recipients", label: "Recipients" },
];

export default function SendersRecipients() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();

  // The URL is the single source of truth — deep links and back/forward work.
  const tabParam = new URLSearchParams(searchParams).get("tab");
  const activeTab: PeopleTab = tabParam === "recipients" ? "recipients" : "senders";

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-2xl font-bold font-display">Senders &amp; Recipients</h1>
            <p className="text-muted-foreground mt-1">
              The people you pay and get paid by — in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2" data-testid="tabs-people">
            {PEOPLE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setLocation(`/senders-recipients?tab=${tab.value}`)}
                data-testid={`tab-${tab.value}`}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all",
                  activeTab === tab.value
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Both panels stay mounted — the inactive one is hidden, so
              locally added senders/recipients survive tab switches. */}
          <div className={activeTab === "senders" ? "" : "hidden"} data-testid="panel-senders">
            <SendersPanel />
          </div>
          <div className={activeTab === "recipients" ? "" : "hidden"} data-testid="panel-recipients">
            <RecipientsPanel />
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
