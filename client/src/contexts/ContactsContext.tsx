import React, { createContext, useContext, useState, useEffect } from "react";
import { Contact, initialContacts } from "@/data/contacts";
import { generateUniqueCode } from "@/lib/recipients";

interface ContactsContextType {
  contacts: Contact[];
  senders: Contact[];
  recipients: Contact[];
  upsertSender: (data: Partial<Contact> & { email: string }) => Contact;
  upsertRecipient: (data: Partial<Contact> & { email: string }) => Contact;
  deleteContactRole: (email: string, role: "sender" | "recipient") => void;
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

  const upsertSender = (data: Partial<Contact> & { email: string }): Contact => {
    const normalized = data.email.trim().toLowerCase();
    const existingIndex = contacts.findIndex((c) => c.email.toLowerCase() === normalized);

    const existingCodes = contacts.map((c) => c.uniqueCode).filter(Boolean);
    if (existingIndex >= 0) {
      const existing = contacts[existingIndex];
      const updated: Contact = {
        ...existing,
        ...data,
        email: normalized,
        isSender: true,
        // Preserve existing recipient status and banking details if present
        isRecipient: existing.isRecipient,
        uniqueCode: existing.uniqueCode || (data.uniqueCode || generateUniqueCode(existingCodes)),
        bankName: data.bankName || existing.bankName,
        accountNumber: data.accountNumber || existing.accountNumber,
        sortCode: data.sortCode || existing.sortCode,
        iban: data.iban || existing.iban,
        swift: data.swift || existing.swift,
        serviceType: data.serviceType || existing.serviceType,
        narration: data.narration || existing.narration,
        updatedAt: new Date().toISOString(),
      };
      setContacts((prev) => {
        const next = [...prev];
        next[existingIndex] = updated;
        return next;
      });
      return updated;
    } else {
      const newContact: Contact = {
        id: `cnt-${Date.now().toString().slice(-6)}`,
        email: normalized,
        contactType: data.contactType || "individual",
        isSender: true,
        isRecipient: false,
        firstName: data.firstName || "",
        middleName: data.middleName || "",
        lastName: data.lastName || "",
        businessName: data.businessName || "",
        countryCode: data.countryCode || "+234",
        phone: data.phone || "",
        dob: data.dob || "",
        country: data.country || "Nigeria",
        currency: data.currency || (data.country === "United Kingdom" ? "GBP" : data.country === "Nigeria" ? "NGN" : "USD"),
        relationship: data.relationship || "Personal",
        createdAt: data.createdAt || new Date().toISOString().split("T")[0],
        bankName: data.bankName || "",
        accountNumber: data.accountNumber || "",
        sortCode: data.sortCode || "",
        iban: data.iban || "",
        swift: data.swift || "",
        serviceType: data.serviceType || "Bank Deposit",
        uniqueCode: data.uniqueCode || generateUniqueCode(existingCodes),
        narration: data.narration || "",
      };
      setContacts((prev) => [...prev, newContact]);
      return newContact;
    }
  };

  const upsertRecipient = (data: Partial<Contact> & { email: string }): Contact => {
    const normalized = data.email.trim().toLowerCase();
    const existingIndex = contacts.findIndex((c) => c.email.toLowerCase() === normalized);
    const existingCodes = contacts.map((c) => c.uniqueCode).filter(Boolean);

    if (existingIndex >= 0) {
      const existing = contacts[existingIndex];
      const updated: Contact = {
        ...existing,
        ...data,
        email: normalized,
        isRecipient: true,
        // Preserve existing sender status and details
        isSender: existing.isSender,
        firstName: data.firstName || existing.firstName,
        middleName: data.middleName || existing.middleName,
        lastName: data.lastName || existing.lastName,
        businessName: data.businessName || existing.businessName,
        contactType: data.contactType || existing.contactType,
        countryCode: data.countryCode || existing.countryCode,
        phone: data.phone || existing.phone,
        dob: existing.dob || data.dob || "",
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
      const newContact: Contact = {
        id: `rec-${Date.now().toString().slice(-6)}`,
        email: normalized,
        contactType: data.contactType || "individual",
        isSender: false,
        isRecipient: true,
        firstName: data.firstName || "",
        middleName: data.middleName || "",
        lastName: data.lastName || "",
        businessName: data.businessName || "",
        countryCode: data.countryCode || "+234",
        phone: data.phone || "",
        dob: data.dob || "",
        country: data.country || "United Kingdom",
        currency: data.currency || (data.country === "United Kingdom" ? "GBP" : data.country === "Nigeria" ? "NGN" : "USD"),
        relationship: data.relationship || "Personal",
        createdAt: data.createdAt || new Date().toISOString().split("T")[0],
        bankName: data.bankName || "",
        accountNumber: data.accountNumber || "",
        sortCode: data.sortCode || "",
        iban: data.iban || "",
        swift: data.swift || "",
        serviceType: data.serviceType || "Bank Deposit",
        uniqueCode: data.uniqueCode || generateUniqueCode(existingCodes),
        narration: data.narration || "",
      };
      setContacts((prev) => [...prev, newContact]);
      return newContact;
    }
  };

  const deleteContactRole = (email: string, role: "sender" | "recipient") => {
    const normalized = email.trim().toLowerCase();
    const existing = contacts.find((c) => c.email.toLowerCase() === normalized);
    if (!existing) return;

    // If contact has both roles, just disable the removed role
    if (existing.isSender && existing.isRecipient) {
      setContacts((prev) =>
        prev.map((c) => {
          if (c.email.toLowerCase() === normalized) {
            return {
              ...c,
              isSender: role === "sender" ? false : c.isSender,
              isRecipient: role === "recipient" ? false : c.isRecipient,
            };
          }
          return c;
        })
      );
    } else {
      // If only had this single role, remove completely
      setContacts((prev) => prev.filter((c) => c.email.toLowerCase() !== normalized));
    }
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
