import React from 'react'

/**
 * Standardized Page Header component for all admin routes.
 * 
 * @param {string} title - The main heading text
 * @param {string} subtitle - The secondary description text
 * @param {string} badge - Optional badge text (e.g. "Recycle Bin")
 * @param {string} badgeType - 'danger' | 'neutral' (default: 'neutral')
 * @param {React.ReactNode} badgeIcon - Optional icon to show inside the badge
 * @param {React.ReactNode} children - Action buttons or content for the right side
 */
export default function PageHeader({ 
  title, 
  subtitle, 
  badge, 
  badgeType = 'neutral',
  badgeIcon,
  children 
}) {
  const badgeColors = {
    danger: 'bg-red-500/10 text-red-600 border-red-200',
    neutral: 'bg-black/5 text-black/50 border-black/5'
  }

  return (
    <div className="flex flex-col gap-1 mb-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2" style={{ color: 'var(--text)' }}>
            {title}
            {badge && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest leading-none flex items-center gap-1 border ${badgeColors[badgeType] || badgeColors.neutral}`}>
                {badgeIcon && <span className="shrink-0">{badgeIcon}</span>}
                {badge}
              </span>
            )}
          </h1>
          {subtitle && (
            <p className="text-[12px] font-medium opacity-40" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>

        {children && (
          <div className="flex items-center gap-2">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
