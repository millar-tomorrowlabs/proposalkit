import { useState } from "react"
import { Check, Star } from "lucide-react"
import type { InvestmentConfig, ConfirmedSelection } from "@/types/proposal"
import { formatPrice as formatCurrency } from "@/lib/currency"
import InlineEditable from "./InlineEditable"
import AskAIGhost from "./AskAIGhost"

interface InvestmentSectionProps {
  data: InvestmentConfig
  currency?: string
  recommendation?: string
  onConfirm: (selection: ConfirmedSelection | null) => void
}

const InvestmentSection = ({
  data,
  currency = "USD",
  recommendation,
  onConfirm,
}: InvestmentSectionProps) => {
  const formatPrice = (n: number) => formatCurrency(n, currency)

  const [activePackageId, setActivePackageId] = useState(data.packages[0]?.id ?? "")
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<Set<string>>(new Set())
  const [retainerHours, setRetainerHours] = useState(
    data.retainer ? data.retainer.minHours + 2 : 0
  )
  const [confirmed, setConfirmed] = useState(false)
  const [postLaunchSelected, setPostLaunchSelected] = useState(false)

  if (data.packages.length === 0) {
    return (
      <section id="investment" className="px-6 pt-24 pb-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl">
            Investment
          </h2>
          <p className="mt-6 text-sm text-muted-foreground">No packages configured yet.</p>
        </div>
      </section>
    )
  }

  const currentPackage = data.packages.find((p) => p.id === activePackageId)!

  // Assemble highlights: generic perks from package + add-ons flagged for this package
  const assembledHighlights = [
    ...currentPackage.highlights,
    ...data.addOns
      .filter((a) => a.highlightInPackage?.includes(activePackageId))
      .map((a) => a.label),
  ]

  const switchPackage = (packageId: string) => {
    setActivePackageId(packageId)
    setSelectedAddOnIds((prev) => {
      const next = new Set<string>()
      prev.forEach((id) => {
        const addOn = data.addOns.find((a) => a.id === id)
        if (addOn?.packages[packageId]?.price !== undefined) next.add(id)
      })
      return next
    })
  }

  const toggleAddOn = (id: string) => {
    if (confirmed) return
    setSelectedAddOnIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Per add-on: max price across all packages (= list price on non-discounted package)
  const getMaxPrice = (addOnId: string) => {
    const addOn = data.addOns.find((a) => a.id === addOnId)!
    return Math.max(...Object.values(addOn.packages).map((p) => p.price ?? 0))
  }

  const addOnsTotal = Array.from(selectedAddOnIds).reduce((sum, id) => {
    const addOn = data.addOns.find((a) => a.id === id)
    return sum + (addOn?.packages[activePackageId]?.price ?? 0)
  }, 0)

  const grandTotal = currentPackage.basePrice + addOnsTotal

  const addOnSavings = Array.from(selectedAddOnIds).reduce((sum, id) => {
    const addOn = data.addOns.find((a) => a.id === id)
    if (!addOn) return sum
    const currentPrice = addOn.packages[activePackageId]?.price ?? 0
    const maxPrice = getMaxPrice(id)
    return sum + (maxPrice - currentPrice)
  }, 0)

  // Auto-calculated: sum of max prices for add-ons included in this package
  const includedAddOnValue = data.addOns
    .filter((a) => a.packages[activePackageId]?.included === true)
    .reduce((sum, a) => sum + getMaxPrice(a.id), 0)

  // Post-launch value included with this package (e.g. 2 weeks at €2,500/mo = €1,250)
  const postLaunchValue = (() => {
    if (!data.postLaunch?.includedInPackage || data.postLaunch.includedInPackage !== activePackageId) return 0
    if (!data.postLaunch.includedWeeks || !data.postLaunch.monthlyPrice) return 0
    return data.postLaunch.monthlyPrice * (data.postLaunch.includedWeeks / 4)
  })()

  // Base price premium: how much more this package costs vs. the cheapest alternative
  const otherPackage = data.packages.find((p) => p.id !== activePackageId)
  const basePricePremium = Math.max(0, currentPackage.basePrice - (otherPackage?.basePrice ?? currentPackage.basePrice))

  // Net savings: total add-on + post-launch value minus the base price premium
  const totalSavings = includedAddOnValue + addOnSavings + postLaunchValue - basePricePremium

  // For "Saving X vs. Y" — reference the comparison package
  const comparisonPackageLabel = (() => {
    if (totalSavings <= 0) return null
    return otherPackage ? otherPackage.label : null
  })()

  const selectedAddOns = Array.from(selectedAddOnIds).map((id) => {
    const addOn = data.addOns.find((a) => a.id === id)!
    return { id: addOn.id, label: addOn.label, price: addOn.packages[activePackageId]?.price ?? 0 }
  })

  return (
    <section id="investment" className="px-6 pt-24 pb-16">
      <div className="mx-auto max-w-3xl">
        <h2 className="scroll-reveal font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl">
          Investment
        </h2>

        <p className="scroll-reveal delay-100 mt-6 text-lg text-muted-foreground">
          {data.packages.length > 1
            ? `${data.packages.length} options, one goal.`
            : "Here's what this engagement looks like."}
        </p>

        <p className="scroll-reveal delay-100 mt-4 text-sm text-muted-foreground">
          Select a package and customize below. When you're happy with your
          selection, hit Confirm — we'll include the details when you get in touch.
        </p>

        {recommendation ? (
          <div className="scroll-reveal delay-200 mt-10 rounded-lg border border-brand-1/30 bg-brand-1-light p-6">
            <div className="text-sm leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Our recommendation</strong>{" "}
              <InlineEditable
                fieldPath="recommendation"
                value={recommendation}
                multiline
                tag="span"
                className="text-sm leading-relaxed text-muted-foreground"
              />
            </div>
          </div>
        ) : (
          <AskAIGhost value={recommendation} prompt="Write a recommendation paragraph explaining which package you suggest and why — be specific to this client's needs." className="mt-6" />
        )}

        {/* Package toggle — only shown when > 1 package */}
        {data.packages.length > 1 && (
          <div className="scroll-reveal delay-300 mt-10 flex gap-2 rounded-full border border-border bg-card p-1">
            {data.packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => switchPackage(pkg.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  activePackageId === pkg.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {pkg.isRecommended && <Star className="h-3.5 w-3.5" />}
                {pkg.label} — {formatPrice(pkg.basePrice)}
              </button>
            ))}
          </div>
        )}

        {/* Package card */}
        <div className="scroll-reveal delay-400 mt-6">
          <div
            className={`rounded-lg border-2 bg-card p-8 ${
              currentPackage.isRecommended ? "border-brand-1/40" : "border-brand-2/30"
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-xl font-semibold text-foreground">
                    {currentPackage.label}
                  </h3>
                  {currentPackage.isRecommended && (
                    <span className="rounded-full bg-brand-1 px-2.5 py-0.5 text-xs font-medium text-white">
                      Recommended
                    </span>
                  )}
                </div>
                {assembledHighlights[0] && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {assembledHighlights[0]}
                  </p>
                )}
              </div>
              <div className="sm:text-right">
                <p className="font-display text-3xl font-semibold text-foreground">
                  {formatPrice(currentPackage.basePrice)}
                </p>
                {totalSavings > 0 && (
                  <p className="mt-1 text-xs font-medium text-brand-1">
                    Saving {formatPrice(totalSavings)}{comparisonPackageLabel ? ` vs. ${comparisonPackageLabel}` : ''}
                  </p>
                )}
              </div>
            </div>

            {assembledHighlights.length > 1 && (
              <div className="mt-6 border-t border-border pt-6">
                <p className="mb-4 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  Included
                </p>
                <ul className="space-y-3">
                  {assembledHighlights.slice(1).map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm text-foreground"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-1" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Add-ons */}
        <div className="scroll-reveal delay-500 mt-8 space-y-8">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Optional add-ons
            </p>
            {addOnSavings > 0 && (
              <p className="text-xs text-brand-1">
                Prices reflect your {currentPackage.label} discount
              </p>
            )}
          </div>

          {data.addOnCategories.map((category) => {
            const categoryAddOns = data.addOns.filter(
              (a) => a.category === category.id
            )
            const visibleAddOns = categoryAddOns.filter((a) => {
              const config = a.packages[activePackageId]
              return config && (config.price !== undefined || config.included)
            })
            if (visibleAddOns.length === 0) return null

            return (
              <div key={category.id} className="space-y-3">
                <p className="text-xs font-medium text-foreground">{category.label}</p>
                {visibleAddOns.map((addOn) => {
                  const config = addOn.packages[activePackageId]!
                  const isSelected = selectedAddOnIds.has(addOn.id)
                  const maxPrice = getMaxPrice(addOn.id)
                  const hasDiscount =
                    config.price !== undefined && config.price < maxPrice

                  if (config.included) {
                    return (
                      <div
                        key={addOn.id}
                        className="flex w-full items-center justify-between rounded-lg border border-brand-1/30 bg-brand-1-light p-4"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {addOn.label}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {addOn.description}
                          </p>
                        </div>
                        <span className="rounded-full bg-brand-1 px-2.5 py-0.5 text-xs font-medium text-white">
                          Included
                        </span>
                      </div>
                    )
                  }

                  return (
                    <button
                      key={addOn.id}
                      onClick={() => toggleAddOn(addOn.id)}
                      className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-all duration-200 ${
                        isSelected
                          ? "border-brand-1 bg-brand-1-light"
                          : "border-border bg-card"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {addOn.label}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {addOn.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {hasDiscount && (
                            <p className="text-xs line-through text-muted-foreground">
                              +{formatPrice(maxPrice)}
                            </p>
                          )}
                          <span className="text-sm font-semibold text-foreground">
                            +{formatPrice(config.price!)}
                          </span>
                          {hasDiscount && (
                            <p className="text-xs font-medium text-brand-1">
                              Save {formatPrice(maxPrice - config.price!)}
                            </p>
                          )}
                        </div>
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-brand-1 bg-brand-1"
                              : "border-border"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Project Total */}
        <div className="scroll-reveal mt-6 rounded-lg border-2 border-foreground bg-card p-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{currentPackage.label} package</span>
              <span className="font-medium text-foreground">
                {formatPrice(currentPackage.basePrice)}
              </span>
            </div>
            {selectedAddOns.map((addon) => (
              <div key={addon.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{addon.label}</span>
                <span className="font-medium text-foreground">+{formatPrice(addon.price)}</span>
              </div>
            ))}
            <div className="mt-2 border-t border-border pt-2 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Project Total</p>
              <div className="text-right">
                <p className="font-display text-2xl font-semibold text-foreground">
                  {formatPrice(grandTotal)}
                </p>
                {totalSavings > 0 && (
                  <p className="mt-0.5 text-xs font-medium text-brand-1">
                    Saving {formatPrice(totalSavings)}{comparisonPackageLabel ? ` vs. ${comparisonPackageLabel}` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Post-Launch Optimization */}
        {data.postLaunch && (
          <div className="scroll-reveal mt-8 rounded-lg border-2 border-border bg-card p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-foreground">
                  Post-Launch Optimization
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Optional monthly service — separate from the support retainer
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {data.postLaunch.description}
                </p>
              </div>
              <p className="shrink-0 font-display text-2xl font-semibold text-foreground">
                {formatPrice(data.postLaunch.monthlyPrice)}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
            </div>

            {data.postLaunch.includedInPackage === activePackageId && data.postLaunch.includedWeeks && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-brand-1/30 bg-brand-1-light px-4 py-2.5">
                <span className="text-xs text-muted-foreground">
                  {data.postLaunch.includedWeeks} weeks included with your {currentPackage.label} package —
                </span>
                <span className="text-xs font-medium text-brand-1">
                  continue monthly from {formatPrice(data.postLaunch.monthlyPrice)}/mo
                </span>
              </div>
            )}

            <button
              onClick={() => !confirmed && setPostLaunchSelected(!postLaunchSelected)}
              className={`mt-4 flex w-full items-center justify-between rounded-lg border p-4 text-left transition-all duration-200 ${
                postLaunchSelected
                  ? "border-brand-1 bg-brand-1-light"
                  : "border-border bg-muted/30"
              }`}
            >
              <p className="text-sm font-medium text-foreground">
                {data.postLaunch.includedInPackage === activePackageId
                  ? "Continue post-launch optimization"
                  : "Add post-launch optimization"}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">
                  +{formatPrice(data.postLaunch.monthlyPrice)}/mo
                </span>
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                    postLaunchSelected
                      ? "border-brand-1 bg-brand-1"
                      : "border-border"
                  }`}
                >
                  {postLaunchSelected && <Check className="h-3 w-3 text-white" />}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Retainer */}
        {data.retainer && (
          <div className="scroll-reveal delay-600 mt-20 rounded-lg border-2 border-border bg-card p-8">
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                Support Retainer
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                First {data.retainer.requiredMonths} months retainer is required with both packages
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Billed at our standard rate of {formatPrice(data.retainer.hourlyRate)}/hour
              </p>
            </div>

            <div
              className={`mt-6 rounded-lg border p-4 transition-all duration-200 ${
                retainerHours === data.retainer.minHours + 2
                  ? "border-brand-1/40 bg-brand-1-light"
                  : "border-border bg-muted/30"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Monthly hours</p>
                  <p className="text-xs text-muted-foreground">
                    Minimum {data.retainer.minHours} hours · Recommended{" "}
                    {data.retainer.minHours + 2} hours
                  </p>
                </div>
                <span className="font-display text-lg font-semibold text-foreground">
                  {retainerHours} hrs
                </span>
              </div>
              <input
                type="range"
                min={data.retainer.minHours}
                max={data.retainer.maxHours}
                value={retainerHours}
                onChange={(e) => !confirmed && setRetainerHours(Number(e.target.value))}
                disabled={confirmed}
                className="w-full accent-[var(--brand-1)] disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{data.retainer.minHours}</span>
                <span>{data.retainer.maxHours}</span>
              </div>
            </div>

            <ul className="mt-5 space-y-2.5">
              <li className="flex items-start gap-3 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                Month-to-month after initial {data.retainer.requiredMonths} months — hours can flex as needed
              </li>
              <li className="flex items-start gap-3 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                Covers support, stabilization &amp; troubleshooting
              </li>
            </ul>

            <div className="mt-6 space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {retainerHours} hours × {formatPrice(data.retainer.hourlyRate)}/hr
                </span>
                <span className="font-medium text-foreground">
                  {formatPrice(retainerHours * data.retainer.hourlyRate)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <p className="text-sm font-medium text-foreground">Monthly Retainer</p>
                <p className="font-display text-2xl font-semibold text-foreground">
                  {formatPrice(retainerHours * data.retainer.hourlyRate)}
                  <span className="text-base font-normal text-muted-foreground">/mo</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Confirm */}
        <div className="scroll-reveal mt-6">
          {!confirmed ? (
            <button
              onClick={() => {
                setConfirmed(true)
                onConfirm({
                  packageId: activePackageId,
                  packageLabel: currentPackage.label,
                  packagePrice: currentPackage.basePrice,
                  addOns: selectedAddOns,
                  retainerHours: data.retainer ? retainerHours : undefined,
                  retainerRate: data.retainer?.hourlyRate,
                  grandTotal,
                })
              }}
              className="w-full rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/80"
            >
              Confirm selection
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-full border border-brand-1/40 bg-brand-1-light px-6 py-3">
              <span className="text-sm font-medium text-foreground">Selection confirmed</span>
              <button
                onClick={() => {
                  setConfirmed(false)
                  onConfirm(null)
                }}
                className="text-xs font-medium text-brand-1 hover:underline"
              >
                Change selection
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default InvestmentSection
