"use strict";

import * as React from "react";
import { format, getMonth, getYear, setMonth, setYear } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PremiumDatePickerProps {
    date?: Date;
    setDate: (date: Date | undefined) => void;
    fromYear?: number;
    toYear?: number;
}

export function PremiumDatePicker({
    date,
    setDate,
    fromYear = 1900,
    toYear = new Date().getFullYear(),
}: PremiumDatePickerProps) {
    const [month, setMonthState] = React.useState<Date>(date || new Date());
    const [open, setOpen] = React.useState(false);

    // Generate Year Options
    const years = React.useMemo(() => {
        const y = [];
        for (let i = toYear; i >= fromYear; i--) {
            y.push(i);
        }
        return y;
    }, [fromYear, toYear]);

    // Generate Month Options
    const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

    const handleYearChange = (year: string) => {
        const newDate = new Date(month);
        newDate.setFullYear(parseInt(year));
        setMonthState(newDate);
    };

    const handleMonthChange = (monthName: string) => {
        const newDate = new Date(month);
        const monthIndex = months.indexOf(monthName);
        newDate.setMonth(monthIndex);
        setMonthState(newDate);
    };

    const handleSelect = (selectedDate: Date | undefined) => {
        setDate(selectedDate);
        if (selectedDate) {
            setMonthState(selectedDate);
            setOpen(false); // Close dialog after selection
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "h-11 w-full pl-3 text-left font-normal border-slate-200 hover:bg-slate-50",
                        !date && "text-muted-foreground"
                    )}
                >
                    {date ? (
                        date.toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                        })
                    ) : (
                        <span>Pick a date</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
            </DialogTrigger>
            <DialogContent className="w-auto p-0 gap-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-white">
                {/* Premium Header with Gradient */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white">
                    <div className="flex flex-col gap-1">
                        <span className="text-blue-100 text-sm font-medium uppercase tracking-wider">Select Date</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold tracking-tight">
                                {date ? format(date, "d") : format(new Date(), "d")}
                            </span>
                            <span className="text-2xl font-light opacity-90">
                                {date ? format(date, "MMMM yyyy") : format(new Date(), "MMMM yyyy")}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Controls & Calendar */}
                <div className="p-4 bg-white">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <Select
                            value={months[month.getMonth()]}
                            onValueChange={handleMonthChange}
                        >
                            <SelectTrigger className="w-[140px] h-9 border-none shadow-none font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors focus:ring-0">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                <ScrollArea className="h-[200px]">
                                    {months.map((m) => (
                                        <SelectItem key={m} value={m} className="font-medium cursor-pointer">
                                            {m}
                                        </SelectItem>
                                    ))}
                                </ScrollArea>
                            </SelectContent>
                        </Select>

                        <Select
                            value={month.getFullYear().toString()}
                            onValueChange={handleYearChange}
                        >
                            <SelectTrigger className="w-[100px] h-9 border-none shadow-none font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors focus:ring-0">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                <ScrollArea className="h-[200px]">
                                    {years.map((y) => (
                                        <SelectItem key={y} value={y.toString()} className="font-medium cursor-pointer">
                                            {y}
                                        </SelectItem>
                                    ))}
                                </ScrollArea>
                            </SelectContent>
                        </Select>
                    </div>

                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={handleSelect}
                        month={month}
                        onMonthChange={setMonthState}
                        disabled={(d: Date) =>
                            d > new Date() || d < new Date("1900-01-01")
                        }
                        initialFocus
                        classNames={{
                            nav: "hidden", // Hide default nav as we use custom dropdowns
                            caption: "hidden", // Hide default caption
                            head_cell: "text-slate-400 font-medium text-xs pb-3",
                            cell: "h-9 w-9 p-0 relative [&:has([aria-selected])]:bg-transparent",
                            day: "h-9 w-9 p-0 font-medium text-sm text-slate-700 aria-selected:bg-blue-600 aria-selected:text-white aria-selected:shadow-lg aria-selected:shadow-blue-600/30 hover:bg-slate-100 hover:text-slate-900 rounded-full transition-all duration-200",
                            day_selected: "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",
                            day_today: "bg-slate-50 text-blue-600 font-bold ring-1 ring-blue-200",
                            day_outside: "text-slate-300 opacity-50",
                            day_disabled: "text-slate-200 opacity-50 cursor-not-allowed hover:bg-transparent",
                            day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                            day_hidden: "invisible",
                        }}
                        className="p-0 pointer-events-auto"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
