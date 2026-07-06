import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 p-5", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-base font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }) {
  return <div data-slot="card-content" className={cn("p-5 pt-0", className)} {...props} />
}

function CardFooter({ className, ...props }) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center border-t bg-muted/40 p-5", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }) {
  return <div data-slot="card-action" className={cn("ml-auto", className)} {...props} />
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
}
