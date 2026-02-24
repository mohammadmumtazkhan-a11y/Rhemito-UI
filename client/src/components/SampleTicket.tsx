import React from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SampleTicket: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 flex justify-center items-start font-sans">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl p-8 border border-gray-200">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-purple-700 font-bold text-xl mb-6">
            <span className="text-2xl">🎟️</span> {/* Placeholder for TicketSir Logo */}
            <span>TicketSir</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-700 uppercase leading-tight">
            BASKETMOUTH - THE LORDS OF THE RIBS | LEEDS
          </h1>
        </div>

        {/* Event Details Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div>
            <h3 className="text-xl font-bold text-slate-700 mb-6">Event Details</h3>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[120px_1fr]">
                <span className="font-bold text-slate-700">Venue Name</span>
                <span className="text-slate-500">The Glee Club Leeds</span>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <span className="font-bold text-slate-700">Venue Address</span>
                <span className="text-slate-500">The Glee Club Leeds, 123 Albion St, Leeds LS2 8ES, UK</span>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <span className="font-bold text-slate-700">Event Date</span>
                <span className="text-slate-500">12 Feb 2026, 06:45 PM</span>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <span className="font-bold text-slate-700">Ticket Delivery</span>
                <span className="text-slate-500">E- Ticket</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <h3 className="text-xl font-bold text-slate-700">Order No 557427</h3>
          </div>
        </div>

        {/* Instructions Section (Refined) */}
        <div className="mb-8">
          <h4 className="text-sm font-bold text-gray-400 uppercase mb-6 tracking-wide">INSTRUCTIONS</h4>
          <div className="flex flex-wrap items-start justify-between gap-8 border-b border-gray-100 pb-10">

            {/* Age */}
            <div className="flex items-center space-x-2">
              <span className="font-bold text-gray-800 text-lg">Age:</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-5 h-5 text-gray-400 hover:text-blue-500 cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Age restrictions apply</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Shoe Type */}
            <div className="flex flex-col">
              <span className="text-sm text-gray-400 mb-1">Shoe Type</span>
              <span className="font-bold text-gray-800 text-lg">Not Applicable</span>
            </div>

            {/* Dress Code */}
            <div className="flex flex-col">
              <span className="text-sm text-gray-400 mb-1">Dress code</span>
              <span className="font-bold text-gray-800 text-lg">Not Applicable</span>
            </div>

            {/* ID Required */}
            <div className="flex flex-col">
              <span className="text-sm text-gray-400 mb-1">ID required</span>
              <span className="font-bold text-gray-800 text-lg">Yes</span>
            </div>
          </div>
        </div>


        {/* Date Card Section (Refined) */}
        <div className="bg-[#FFF8F0] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 md:gap-12 mb-10 shadow-sm border border-orange-50/50">
          {/* Date Box */}
          <div className="bg-white rounded-2xl w-32 h-32 flex flex-col items-center justify-center shadow-sm shrink-0">
            <span className="text-5xl font-bold text-slate-800">12</span>
            <span className="text-xl font-medium text-slate-500">Feb</span>
          </div>

          {/* Timings */}
          <div className="flex-1 w-full space-y-4">
            <div className="flex justify-between items-center border-b border-orange-200/50 pb-3 border-dashed last:border-0 last:pb-0">
              <span className="text-slate-600 font-medium text-lg">Start Date</span>
              <span className="text-slate-900 font-bold text-lg">12 Feb 2026, 18:45 HRS</span>
            </div>
            <div className="flex justify-between items-center border-b border-orange-200/50 pb-3 border-dashed last:border-0 last:pb-0">
              <span className="text-slate-600 font-medium text-lg">End Date</span>
              <span className="text-slate-900 font-bold text-lg">12 Feb 2026, 22:45 HRS</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-600 font-medium text-lg">Gate Closes</span>
              <span className="text-slate-900 font-bold text-lg">12 Feb 2026, 19:15 HRS</span>
            </div>
          </div>
        </div>

        {/* Ticket Footer / QR Section */}
        <div className="border rounded-lg p-6 flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
          <div className="space-y-4">
            <div className="text-slate-600 text-sm">
              Ordered by <span className="font-bold text-slate-800">Ehi Ekoma</span> on 08 Feb 2026; 18:39 hrs
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-lg mb-1">Ticket Description</h4>
              <p className="text-slate-500 text-sm">General Admission - Second Release</p>
              <p className="text-slate-400 text-xs mt-1">Price is inclusive of booking fees and venue facility fee. Non-refundable.</p>
            </div>
            <div>
              <span className="font-bold text-slate-700">Refund policy: Non Refundable</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="text-right w-full mb-2">
              <span className="block text-slate-500 text-sm">price</span>
              <span className="block font-bold text-slate-800 text-lg">27.50</span>
            </div>
            {/* QR Code Placeholder */}
            <div className="bg-white p-2 border border-slate-200">
              <div className="w-24 h-24 bg-slate-900"></div> {/* Actual QR code would go here */}
            </div>
            <span className="text-xs text-slate-400 tracking-widest">73JLGPVPA</span>
          </div>
        </div>

        {/* Attendee Info */}
        <div className="border rounded-lg p-6 space-y-6 mb-8">
          <div className="grid grid-cols-[140px_1fr] items-center">
            <span className="font-bold text-slate-700 text-lg">Name:</span>
            <span className="font-bold text-slate-600 text-lg">Ehi Umeh</span>
          </div>
          <div className="grid grid-cols-[140px_1fr] items-center">
            <span className="font-bold text-slate-700 text-lg">Entrance:</span>
            <span className="font-bold text-slate-600 text-lg">N/A</span>
          </div>
          <div className="grid grid-cols-[140px_1fr] items-center">
            <span className="font-bold text-slate-700 text-lg">Ticket Type:</span>
            <span className="font-bold text-slate-600 text-lg">General Admission - Second Release</span>
          </div>
          <div className="grid grid-cols-[140px_1fr] items-center">
            <span className="font-bold text-slate-700 text-lg">Allocation:</span>
            <span className="font-bold text-slate-600 text-lg">General Admission</span>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="bg-gray-50/50 p-6 border rounded-lg">
          <h3 className="text-slate-700 font-bold mb-4 uppercase">THANK YOU FOR CHOOSING TICKETSIR</h3>
          <p className="text-slate-500 text-xs mb-4">Please keep your tickets safe at all times. Ensure the QR Code area is dry and not ruffled at all times.</p>
          <p className="text-slate-500 text-xs mb-4">The QR Code allows one entry per scan. Unauthorised duplication of this ticket may prevent your attendance to the event. Unlawful resale (or attempted) is grounds for seizure or cancellation. Subsequent scans (whether of the original or copies) will be denied entry.</p>
          <p className="text-slate-500 text-xs">Terms and Condition apply. To see the full terms and conditions please visit <a href="#" className="text-blue-600 underline">www.ticketsir.com</a></p>
        </div>

      </div>
    </div>
  );
};

export default SampleTicket;
