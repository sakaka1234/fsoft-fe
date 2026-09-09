import * as React from "react"
import { cn } from "@/lib/cn"
import { CaretLeft } from "@phosphor-icons/react/CaretLeft"
import { CaretRight } from "@phosphor-icons/react/CaretRight"
import { DotsThree } from "@phosphor-icons/react/DotsThree"

import { buttonClasses } from "@/components/ui/button-styles"

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
  className?: string
} & React.ComponentProps<"a">

function PaginationLink({
  className,
  isActive,
  ...props
}: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      aria-disabled={props["aria-disabled"]}
      className={cn(
        buttonClasses(isActive ? "secondary" : "secondary", "md", className),
        "h-9 w-9 cursor-pointer p-0 justify-center",
        isActive &&
          "border-accent text-accent-text bg-accent-soft/40 font-semibold",
        !isActive && "text-muted hover:text-ink",
        props["aria-disabled"] && "pointer-events-none opacity-50",
      )}
      {...props}
    />
  )
}

function PaginationPrevious({
  className,
  text = "Trước",
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      className={cn("w-auto px-3!", className)}
      {...props}
    >
      <CaretLeft size={15} />
      <span className="hidden sm:block">{text}</span>
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  text = "Sau",
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      className={cn("w-auto px-3!", className)}
      {...props}
    >
      <span className="hidden sm:block">{text}</span>
      <CaretRight size={15} />
    </PaginationLink>
  )
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-9 items-center justify-center text-muted",
        className
      )}
      {...props}
    >
      <DotsThree size={16} />
      <span className="sr-only">More pages</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}