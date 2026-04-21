"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DayPickerProps, useDayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = DayPickerProps

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function MonthYearCaption() {
  const { goToMonth, months } = useDayPicker()
  const currentMonth = months[0]?.date ?? new Date()

  const currentYear = new Date().getFullYear()
  const startYear = currentYear - 10
  const endYear = currentYear + 10

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDate = new Date(currentMonth)
    newDate.setMonth(parseInt(e.target.value))
    goToMonth(newDate)
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDate = new Date(currentMonth)
    newDate.setFullYear(parseInt(e.target.value))
    goToMonth(newDate)
  }

  const selectBase =
    "text-sm font-semibold bg-transparent border border-input rounded-md px-2 py-1 pr-6 " +
    "appearance-none cursor-pointer hover:bg-accent hover:text-accent-foreground " +
    "focus:outline-none focus:ring-1 focus:ring-ring transition-colors"

  return (
    <div className="flex items-center gap-1">
      <div className="relative">
        <select
          value={currentMonth.getMonth()}
          onChange={handleMonthChange}
          className={selectBase}
          aria-label="Select month"
        >
          {MONTHS.map((name, idx) => (
            <option key={name} value={idx}>{name}</option>
          ))}
        </select>
        <ChevronRight className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 rotate-90 opacity-50" />
      </div>
      <div className="relative">
        <select
          value={currentMonth.getFullYear()}
          onChange={handleYearChange}
          className={selectBase}
          aria-label="Select year"
        >
          {Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i).map((yr) => (
            <option key={yr} value={yr}>{yr}</option>
          ))}
        </select>
        <ChevronRight className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 rotate-90 opacity-50" />
      </div>
    </div>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-between items-center px-1 pt-1",
        caption_label: "hidden",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7",
        weekday: "text-muted-foreground text-center font-medium text-[0.8rem] py-1",
        week: "grid grid-cols-7 mt-1",
        day: "text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal mx-auto rounded-full aria-selected:opacity-100"
        ),
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-full",
        today: "bg-accent text-accent-foreground rounded-full",
        outside:
          "text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-30",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" {...rest} />
          ) : (
            <ChevronRight className="h-4 w-4" {...rest} />
          ),
        CaptionLabel: () => <MonthYearCaption />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
