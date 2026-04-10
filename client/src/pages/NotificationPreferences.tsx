import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Globe,
  Mail,
  Smartphone,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  Activity,
  Megaphone,
  Lock,
  ChevronLeft,
} from "lucide-react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useNotifications } from "@/contexts/NotificationContext";
import { useToast } from "@/hooks/use-toast";
import type { NotificationPreferences } from "@/contexts/NotificationContext";

// ─── Hours list ───────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return `${h}:00`;
});

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ChannelRowProps {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  comingSoon?: boolean;
}

function ChannelRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  comingSoon,
}: ChannelRowProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-border last:border-b-0">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-foreground">{label}</span>
          {comingSoon && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              Coming soon
            </Badge>
          )}
          {!comingSoon && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 h-4",
                checked
                  ? "border-teal/30 text-teal bg-teal/5"
                  : "text-muted-foreground"
              )}
            >
              {checked ? "Enabled" : "Disabled"}
            </Badge>
          )}
        </div>
        <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={`Toggle ${label} notifications`}
      />
    </div>
  );
}

interface EventRowProps {
  icon: React.ElementType;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  critical?: boolean;
  gdprCopy?: string;
}

function EventRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  critical,
  gdprCopy,
}: EventRowProps): React.JSX.Element {
  // AC 1.5 — critical categories render as locked, always-on, and cannot be turned off.
  // The toggle is force-checked and disabled; keyboard and mouse interactions are blocked.
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-border last:border-b-0">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center mt-0.5">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-foreground">{label}</span>
          {critical && (
            <Lock className="w-3 h-3 text-muted-foreground" />
          )}
        </div>
        {description && (
          <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>
        )}
        {critical && (
          <p className="text-[12px] text-muted-foreground/70 mt-0.5 italic">
            Critical notifications cannot be fully disabled
          </p>
        )}
        {gdprCopy && (
          <p className="text-[12px] text-muted-foreground mt-0.5">{gdprCopy}</p>
        )}
      </div>
      <Switch
        checked={critical ? true : checked}
        onCheckedChange={critical ? () => undefined : onCheckedChange}
        disabled={critical}
        aria-label={`Toggle ${label} notifications${critical ? " (locked — critical)" : ""}`}
      />
    </div>
  );
}

// ─── Default prefs ────────────────────────────────────────────────────────────

const DEFAULT_PREFS: NotificationPreferences = {
  channels: {
    inApp: true,
    browserPush: false,
    email: true,
    mobilePush: false,
  },
  eventTypes: {
    payment: true,
    transactionStatus: true,
    refund: true,
    kyc: true,
    security: true,
    system: true,
    marketing: false,
  },
  quietHours: {
    enabled: false,
    from: "22:00",
    to: "08:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationPreferences(): React.JSX.Element {
  const [, navigate] = useLocation();
  const { preferences } = useNotifications();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [prefs, setPrefs] = useState<NotificationPreferences>(
    preferences ?? DEFAULT_PREFS
  );
  const [saveFlash, setSaveFlash] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (updated: NotificationPreferences) => {
      const res = await apiRequest("PATCH", "/api/notifications/preferences", updated);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      toast({ title: "Preferences saved", description: "Your notification preferences have been updated." });
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1500);
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
    },
  });

  const updateChannel = (key: keyof NotificationPreferences["channels"], v: boolean): void => {
    setPrefs((p) => ({ ...p, channels: { ...p.channels, [key]: v } }));
  };

  const updateEvent = (key: keyof NotificationPreferences["eventTypes"], v: boolean): void => {
    setPrefs((p) => ({ ...p, eventTypes: { ...p.eventTypes, [key]: v } }));
  };

  const updateQuietHours = (
    key: keyof NotificationPreferences["quietHours"],
    v: string | boolean
  ): void => {
    setPrefs((p) => ({
      ...p,
      quietHours: { ...p.quietHours, [key]: v },
    }));
  };

  const nextQuietWindow = (): string => {
    const { from, to, timezone } = prefs.quietHours;
    const tz = timezone.split("/").pop()?.replace("_", " ") ?? timezone;
    return `Next quiet window: Tonight ${from} – ${to} (${tz})`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 md:px-6 h-14 flex items-center gap-3">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              navigate("/");
            }
          }}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <h1 className="font-display text-[16px] font-semibold text-foreground">
          Notification Preferences
        </h1>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32 md:pb-6 space-y-6">

        {/* Channels */}
        <section>
          <h2 className="font-display text-[14px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Channels
          </h2>
          <div className="bg-card border border-border rounded-xl px-4">
            <ChannelRow
              icon={Bell}
              label="In-App"
              description="Show notifications inside the app"
              checked={prefs.channels.inApp}
              onCheckedChange={(v) => updateChannel("inApp", v)}
            />
            <ChannelRow
              icon={Globe}
              label="Browser Push"
              description="Browser push notifications when Rhemito is not open"
              checked={prefs.channels.browserPush}
              onCheckedChange={(v) => updateChannel("browserPush", v)}
            />
            <ChannelRow
              icon={Mail}
              label="Email"
              description="Receive notification emails to your registered address"
              checked={prefs.channels.email}
              onCheckedChange={(v) => updateChannel("email", v)}
            />
            <ChannelRow
              icon={Smartphone}
              label="Mobile Push"
              description="Native push notifications on your mobile device"
              checked={prefs.channels.mobilePush}
              onCheckedChange={() => undefined}
              disabled
              comingSoon
            />
          </div>
        </section>

        {/* Event Types */}
        <section>
          <h2 className="font-display text-[14px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Event Types
          </h2>
          <div className="bg-card border border-border rounded-xl px-4">
            <EventRow
              icon={CreditCard}
              label="Payment"
              description="Payment received, awaiting payment, payment failed"
              checked={prefs.eventTypes.payment}
              onCheckedChange={(v) => updateEvent("payment", v)}
              critical
            />
            <EventRow
              icon={Activity}
              label="Transaction Status"
              description="Transaction complete, cancelled, auto-cancel reminders"
              checked={prefs.eventTypes.transactionStatus}
              onCheckedChange={(v) => updateEvent("transactionStatus", v)}
              critical
            />
            <EventRow
              icon={RefreshCw}
              label="Refund"
              description="Refund processed and returned to your payment method"
              checked={prefs.eventTypes.refund}
              onCheckedChange={(v) => updateEvent("refund", v)}
            />
            <EventRow
              icon={ShieldCheck}
              label="KYC / Compliance"
              description="Document required, document received, review updates"
              checked={prefs.eventTypes.kyc}
              onCheckedChange={(v) => updateEvent("kyc", v)}
              critical
            />
            <EventRow
              icon={Lock}
              label="Security"
              description="Login alerts, password changes, suspicious activity"
              checked={prefs.eventTypes.security}
              onCheckedChange={(v) => updateEvent("security", v)}
            />
            <EventRow
              icon={Activity}
              label="System / Maintenance"
              description="Scheduled maintenance and system status updates"
              checked={prefs.eventTypes.system}
              onCheckedChange={(v) => updateEvent("system", v)}
            />
            <EventRow
              icon={Megaphone}
              label="Marketing"
              checked={prefs.eventTypes.marketing}
              onCheckedChange={(v) => updateEvent("marketing", v)}
              gdprCopy="I consent to receiving promotional offers and marketing communications"
            />
          </div>
        </section>

        {/* Quiet Hours */}
        <section>
          <h2 className="font-display text-[14px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Quiet Hours
          </h2>
          <div className="bg-card border border-border rounded-xl px-4 py-3.5 space-y-4">
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[14px] font-medium text-foreground">Enable Quiet Hours</span>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Suppress non-critical notifications during these hours
                </p>
              </div>
              <Switch
                checked={prefs.quietHours.enabled}
                onCheckedChange={(v) => updateQuietHours("enabled", v)}
                aria-label="Toggle quiet hours"
              />
            </div>

            {prefs.quietHours.enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3 border-t border-border pt-4"
              >
                {/* Time range */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[12px] text-muted-foreground mb-1 block">From</label>
                    <Select
                      value={prefs.quietHours.from}
                      onValueChange={(v) => updateQuietHours("from", v)}
                    >
                      <SelectTrigger className="h-9 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map((h) => (
                          <SelectItem key={h} value={h} className="text-[13px]">
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[12px] text-muted-foreground mb-1 block">To</label>
                    <Select
                      value={prefs.quietHours.to}
                      onValueChange={(v) => updateQuietHours("to", v)}
                    >
                      <SelectTrigger className="h-9 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map((h) => (
                          <SelectItem key={h} value={h} className="text-[13px]">
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Timezone */}
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{prefs.quietHours.timezone}</span>
                </div>

                {/* Preview */}
                <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-[12px] text-muted-foreground">
                  {nextQuietWindow()}
                </div>
              </motion.div>
            )}
          </div>
        </section>
      </div>

      {/* Save button — sticky on mobile, normal on desktop */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border md:static md:bg-transparent md:border-0 md:px-4 md:max-w-2xl md:mx-auto md:pb-8">
        <Button
          onClick={() => saveMutation.mutate(prefs)}
          disabled={saveMutation.isPending}
          className={cn(
            "w-full h-11 text-[14px] font-semibold transition-all duration-300",
            saveFlash && "bg-teal hover:bg-teal/90 text-teal-foreground"
          )}
        >
          {saveMutation.isPending ? "Saving…" : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}
