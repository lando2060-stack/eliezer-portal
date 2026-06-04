import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Company branding */}
        <div className="text-center mb-8">
          <img
            src="/logo.webp"
            alt="אליעזר נכסים"
            className="h-20 mx-auto mb-2 object-contain"
          />
          <p className="text-xs text-muted-foreground font-medium">פורטל סוכנים</p>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-3">
              <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
          </div>
          {children}
        </div>

        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}
