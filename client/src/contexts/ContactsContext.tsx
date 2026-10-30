import React, { createContext, useContext, useState, useEffect } from "react";
import { Contact, initialContacts } from "@/data/contacts";
import { generateUniqueCode } from "@/lib/recipients";

interface ContactsContextType {
  contacts: Contact[];
  senders: Contact[];
  recipients: Contact[];
  upsertSender: (data: Partial<Contact> & { email: string; originalEmail?: string; originalId?: string }) => Contact;
  upsertRecipient: (data: Partial<Contact> & { email: string; originalEmail?: string; originalId?: string }) => Contact;
  deleteContactRole: (
    emailOrId: string,
    role: "sender" | "recipient",
    extraMatch?: { name?: string; accountNumber?: string }
  ) => void;
  deleteContact: (email: string) => void;
  getContactByEmail: (email: string) => Contact | undefined;
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

const STORAGE_KEY = "rhemito_contacts_store";

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore JSON error
    }
    return initialContacts;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
    } catch {
      // ignore storage error
    }
  }, [contacts]);

  const senders = contacts.filter((c) => c.isSender);
  const recipients = contacts.filter((c) => c.isRecipient);

  const getContactByEmail = (email: string): Contact | undefined => {
    const normalized = email.trim().toLowerCase();
    return contacts.find((c) => c.email.toLowerCase() === normalized);
  };

  const upsertSender = (data: Partial<Contact> & { email: string; originalEmail?: string; originalId?: string }): Contact => {
    const normalized = data.email.trim().toLowerCase();
    const origEmail = data.originalEmail?.trim().toLowerCase();
    const origId = data.originalId?.trim().toLowerCase() || data.id?.trim().toLowerCase();
    const existingIndex = contacts.findIndex((c) => {
      if (origId && c.id.toLowerCase() === origId) return true;
      if (origEmail && c.email.toLowerCase() === origEmail) return true;
      return c.email.toLowerCase() === normalized;
    });

    const existingCodes = contacts.map((c) => c.uniqueCode).filter(Boolean);
    if (existingIndex >= 0) {
      const existing = contacts[existingIndex];
      const { originalEmail: _oe, originalId: _oi, ...cleanData } = data;
      const updated: Contact = {
        ...existing,
        ...cleanData,
        email: normalized,
        isSender: true,
        // Preserve existing recipient status and banking details if present
        isRecipient: existing.isRecipient,
        uniqueCode: existing.uniqueCode || (data.uniqueCode || generateUniqueCode(existingCodes)),
        bankName: data.bankName !== undefined ? data.bankName : existing.bankName,
        accountNumber: data.accountNumber !== undefined ? data.accountNumber : existing.accountNumber,
        sortCode: data.sortCode !== undefined ? data.sortCode : existing.sortCode,
        iban: data.iban !== undefined ? data.iban : existing.iban,
        swift: data.swift !== undefined ? data.swift : existing.swift,
        serviceType: data.serviceType !== undefined ? data.serviceType : existing.serviceType,
        narration: data.narration !== undefined ? data.narration : existing.narration,
        updatedAt: new Date().toISOString(),
      };
      setContacts((prev) => {
        const next = [...prev];
        next[existingIndex] = updated;
        return next;
      });
      return updated;
    } else {
      const { originalEmail: _oe, originalId: _oi, ...cleanData } = data;
      const newContact: Contact = {
        id: cleanData.id || `cnt-${Date.now().toString().slice(-6)}`,
        email: normalized,
        contactType: cleanData.contactType || "individual",
        isSender: true,
        isRecipient: false,
        firstName: cleanData.firstName || "",
        middleName: cleanData.middleName || "",
        lastName: cleanData.lastName || "",
        businessName: cleanData.businessName || "",
        countryCode: cleanData.countryCode || "+234",
        phone: cleanData.phone || "",
        dob: cleanData.dob || "",
        country: cleanData.country || "Nigeria",
        currency: cleanData.currency || (cleanData.country === "United Kingdom" ? "GBP" : cleanData.country === "Nigeria" ? "NGN" : "USD"),
        relationship: cleanData.relationship || "Personal",
        createdAt: cleanData.createdAt || new Date().toISOString().split("T")[0],
        bankName: cleanData.bankName || "",
        accountNumber: cleanData.accountNumber || "",
        sortCode: cleanData.sortCode || "",
        iban: cleanData.iban || "",
        swift: cleanData.swift || "",
        serviceType: cleanData.serviceType || "Bank Deposit",
        uniqueCode: cleanData.uniqueCode || generateUniqueCode(existingCodes),
        narration: cleanData.narration || "",
      };
      setContacts((prev) => [...prev, newContact]);
      return newContact;
    }
  };

  const upsertRecipient = (data: Partial<Contact> & { email: string; originalEmail?: string; originalId?: string }): Contact => {
    const normalized = data.email.trim().toLowerCase();
    const origEmail = data.originalEmail?.trim().toLowerCase();
    const origId = data.originalId?.trim().toLowerCase() || data.id?.trim().toLowerCase();
    const existingIndex = contacts.findIndex((c) => {
      if (origId && c.id.toLowerCase() === origId) return true;
      if (origEmail && c.email.toLowerCase() === origEmail) return true;
      return c.email.toLowerCase() === normalized;
    });
    const existingCodes = contacts.map((c) => c.uniqueCode).filter(Boolean);

    if (existingIndex >= 0) {
      const existing = contacts[existingIndex];
      const { originalEmail: _oe, originalId: _oi, ...cleanData } = data;
      const updated: Contact = {
        ...existing,
        ...cleanData,
        email: normalized,
        isRecipient: true,
        // Preserve existing sender status and details
        isSender: existing.isSender,
        firstName: cleanData.firstName !== undefined ? cleanData.firstName : existing.firstName,
        middleName: cleanData.middleName !== undefined ? cleanData.middleName : existing.middleName,
        lastName: cleanData.lastName !== undefined ? cleanData.lastName : existing.lastName,
        businessName: cleanData.businessName !== undefined ? cleanData.businessName : existing.businessName,
        contactType: cleanData.contactType !== undefined ? cleanData.contactType : existing.contactType,
        countryCode: cleanData.countryCode !== undefined ? cleanData.countryCode : existing.countryCode,
        phone: cleanData.phone !== undefined ? cleanData.phone : existing.phone,
        dob: existing.dob || cleanData.dob || "",
        uniqueCode: existing.uniqueCode || generateUniqueCode(existingCodes),
        updatedAt: new Date().toISOString(),
      };
      setContacts((prev) => {
        const next = [...prev];
        next[existingIndex] = updated;
        return next;
      });
      return updated;
    } else {
      const { originalEmail: _oe, originalId: _oi, ...cleanData } = data;
      const newContact: Contact = {
        id: cleanData.id || `rec-${Date.now().toString().slice(-6)}`,
        email: normalized,
        contactType: cleanData.contactType || "individual",
        isSender: false,
        isRecipient: true,
        firstName: cleanData.firstName || "",
        middleName: cleanData.middleName || "",
        lastName: cleanData.lastName || "",
        businessName: cleanData.businessName || "",
        countryCode: cleanData.countryCode || "+234",
        phone: cleanData.phone || "",
        dob: cleanData.dob || "",
        country: cleanData.country || "United Kingdom",
        currency: cleanData.currency || (cleanData.country === "United Kingdom" ? "GBP" : cleanData.country === "Nigeria" ? "NGN" : "USD"),
        relationship: cleanData.relationship || "Personal",
        createdAt: cleanData.createdAt || new Date().toISOString().split("T")[0],
        bankName: cleanData.bankName || "",
        accountNumber: cleanData.accountNumber || "",
        sortCode: cleanData.sortCode || "",
        iban: cleanData.iban || "",
        swift: cleanData.swift || "",
        serviceType: cleanData.serviceType || "Bank Deposit",
        uniqueCode: cleanData.uniqueCode || generateUniqueCode(existingCodes),
        narration: cleanData.narration || "",
      };
      setContacts((prev) => [...prev, newContact]);
      return newContact;
    }
  };

  const deleteContactRole = (
    emailOrId: string,
    role: "sender" | "recipient",
    extraMatch?: { name?: string; accountNumber?: string }
  ) => {
    const normalized = emailOrId.trim().toLowerCase();
    const targetName = (extraMatch?.name || "").trim().toLowerCase();
    const targetAcct = (extraMatch?.accountNumber || "").replace(/\s+/g, "").toLowerCase();

    const matchesTarget = (c: Contact) => {
      if (normalized && (c.email.toLowerCase() === normalized || c.id.toLowerCase() === normalized)) {
        return true;
      }
      const contactFullName = (
        c.contactType === "business"
          ? c.businessName || `${c.firstName} ${c.lastName}`
          : [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ")
      )
        .trim()
        .toLowerCase();
      const contactSimpleName = `${c.firstName || ""} ${c.lastName || ""}`.trim().toLowerCase();
      const contactAcct = (c.accountNumber || c.iban || "").replace(/\s+/g, "").toLowerCase();

      if (targetAcct && targetAcct !== "—" && contactAcct && contactAcct === targetAcct) {
        if (!targetName || contactFullName === targetName || contactSimpleName === targetName) {
          return true;
        }
      }
      if (targetName && (contactFullName === targetName || contactSimpleName === targetName)) {
        if (!targetAcct || targetAcct === "—" || !contactAcct || contactAcct === targetAcct) {
          return true;
        }
      }
      return false;
    };

    setContacts((prev) => {
      const next: Contact[] = [];
      for (const c of prev) {
        if (!matchesTarget(c)) {
          next.push(c);
          continue;
        }
        if (c.isSender && c.isRecipient) {
          next.push({
            ...c,
            isSender: role === "sender" ? false : c.isSender,
            isRecipient: role === "recipient" ? false : c.isRecipient,
          });
        }
      }
      return next;
    });
  };

  const deleteContact = (email: string) => {
    const normalized = email.trim().toLowerCase();
    setContacts((prev) => prev.filter((c) => c.email.toLowerCase() !== normalized));
  };

  return (
    <ContactsContext.Provider
      value={{
        contacts,
        senders,
        recipients,
        upsertSender,
        upsertRecipient,
        deleteContactRole,
        deleteContact,
        getContactByEmail,
      }}
    >
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error("useContacts must be used within a ContactsProvider");
  }
  return context;
}
