import { useBuilderStore } from "@/store/builderStore"
import { Plus, Trash2 } from "lucide-react"
import type { ProposalPackage, AddOn, AddOnCategory, RetainerConfig, PostLaunchConfig } from "@/types/proposal"
import { v4 as uuidv4 } from "uuid"
import { currencySymbol } from "@/lib/currency"

const BuilderSectionInvestment = () => {
  const { proposal, updateField, suggestions, dismissedSuggestions, dismissSuggestion } = useBuilderStore()
  const inv = proposal.investment
  const sym = currencySymbol(proposal.currency)

  const updateInv = (key: keyof typeof inv, value: unknown) => {
    updateField("investment", { ...inv, [key]: value })
  }

  // ── Packages ──────────────────────────────────────────────────────────────

  const addPackage = () => {
    const pkg: ProposalPackage = {
      id: uuidv4().slice(0, 8),
      label: "",
      basePrice: 0,
      isRecommended: false,
      highlights: [],
    }
    updateInv("packages", [...inv.packages, pkg])
  }

  const updatePackage = (index: number, key: keyof ProposalPackage, value: unknown) => {
    updateInv("packages", inv.packages.map((p, i) => i === index ? { ...p, [key]: value } : p))
  }

  const removePackage = (index: number) => {
    const removed = inv.packages[index]
    // Remove this package from all add-on configs
    const addOns = inv.addOns.map((a) => {
      const { [removed.id]: _, ...rest } = a.packages
      return { ...a, packages: rest }
    })
    updateField("investment", { ...inv, packages: inv.packages.filter((_, i) => i !== index), addOns })
  }

  // ── Add-ons ───────────────────────────────────────────────────────────────

  const addAddOn = () => {
    const id = uuidv4().slice(0, 8)
    const packages: AddOn["packages"] = {}
    inv.packages.forEach((p) => { packages[p.id] = {} }) // default: unavailable
    const addOn: AddOn = { id, label: "", description: "", category: inv.addOnCategories[0]?.id ?? "", packages }
    updateInv("addOns", [...inv.addOns, addOn])
  }

  const updateAddOn = (index: number, key: keyof AddOn, value: unknown) => {
    updateInv("addOns", inv.addOns.map((a, i) => i === index ? { ...a, [key]: value } : a))
  }

  const removeAddOn = (index: number) => {
    updateInv("addOns", inv.addOns.filter((_, i) => i !== index))
  }

  // Per-cell: cycle Unavailable → Available ($0) → Included → Unavailable
  const cycleCell = (addOnIndex: number, packageId: string) => {
    const addOn = inv.addOns[addOnIndex]
    const config = addOn.packages[packageId]
    let next: AddOn["packages"][string]
    if (!config || (config.price === undefined && !config.included)) {
      next = { price: 0 }
    } else if (config.price !== undefined) {
      next = { included: true }
    } else {
      next = {}
    }
    const updatedPackages = { ...addOn.packages, [packageId]: next }
    updateAddOn(addOnIndex, "packages", updatedPackages)
  }

  const setCellPrice = (addOnIndex: number, packageId: string, price: number) => {
    const addOn = inv.addOns[addOnIndex]
    const updatedPackages = { ...addOn.packages, [packageId]: { price } }
    updateAddOn(addOnIndex, "packages", updatedPackages)
  }

  // ── Categories ────────────────────────────────────────────────────────────

  const addCategory = () => {
    const cat: AddOnCategory = { id: uuidv4().slice(0, 8), label: "" }
    updateInv("addOnCategories", [...inv.addOnCategories, cat])
  }

  const updateCategory = (index: number, label: string) => {
    updateInv("addOnCategories", inv.addOnCategories.map((c, i) => i === index ? { ...c, label } : c))
  }

  const removeCategory = (index: number) => {
    updateInv("addOnCategories", inv.addOnCategories.filter((_, i) => i !== index))
  }

  // ── Retainer ──────────────────────────────────────────────────────────────

  const updateRetainer = (key: keyof RetainerConfig, value: number) => {
    updateField("investment", { ...inv, retainer: { ...(inv.retainer ?? { hourlyRate: 150, minHours: 3, maxHours: 10, requiredMonths: 6 }), [key]: value } })
  }

  const toggleRetainer = () => {
    if (inv.retainer) {
      const { retainer: _, ...rest } = inv
      updateField("investment", rest)
    } else {
      updateField("investment", { ...inv, retainer: { hourlyRate: 150, minHours: 3, maxHours: 10, requiredMonths: 6 } })
    }
  }

  // ── Post-Launch Optimization ────────────────────────────────────────────

  const updatePostLaunch = (key: keyof PostLaunchConfig, value: unknown) => {
    updateField("investment", { ...inv, postLaunch: { ...(inv.postLaunch!), [key]: value } })
  }

  const togglePostLaunch = () => {
    if (inv.postLaunch) {
      const { postLaunch: _, ...rest } = inv
      updateField("investment", rest)
    } else {
      updateField("investment", {
        ...inv,
        postLaunch: {
          monthlyPrice: 2500,
          description: "A dedicated team monitors your metrics, identifies conversion opportunities, and brings recommendations to you each month. Unlike the support retainer (reactive bug fixes and maintenance), this is proactive.",
          features: ["Conversion monitoring", "Funnel improvements", "A/B testing", "Monthly reporting"],
          includedWeeks: 2,
        },
      })
    }
  }

  return (
    <div className="space-y-8">

      {/* ── Packages ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Packages</h2>
          <button onClick={addPackage} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        {inv.packages.map((pkg, i) => (
          <div key={pkg.id} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={pkg.label}
                onChange={(e) => updatePackage(i, "label", e.target.value)}
                placeholder="Total"
                className="builder-input max-w-[120px] text-sm font-medium"
              />
              <button onClick={() => removePackage(i)} className="text-muted-foreground hover:text-foreground transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Base price</p>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{sym}</span>
                  <input
                    type="number"
                    value={pkg.basePrice}
                    onChange={(e) => updatePackage(i, "basePrice", Number(e.target.value))}
                    className="builder-input"
                  />
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={pkg.isRecommended ?? false}
                onChange={(e) => updatePackage(i, "isRecommended", e.target.checked)}
                className="accent-[var(--brand-1)]"
              />
              Mark as recommended
            </label>
          </div>
        ))}
        {inv.packages.length === 0 && (
          <button onClick={addPackage} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add first package
          </button>
        )}
      </div>

      {/* ── Add-on Matrix ── */}
      {inv.packages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Add-on pricing</h2>
            <button onClick={addAddOn} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Click a cell to cycle: Unavailable → Available → Included</p>

          {inv.addOns.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Add-on</th>
                    {inv.packages.map((pkg) => (
                      <th key={pkg.id} className="px-3 py-2 text-center font-medium text-muted-foreground whitespace-nowrap">
                        {pkg.label || "Package"}
                      </th>
                    ))}
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inv.addOns.map((addOn, ai) => (
                    <tr key={addOn.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <span className="font-medium text-foreground">{addOn.label || <span className="text-muted-foreground italic">unnamed</span>}</span>
                        {addOn.category && (
                          <span className="ml-2 text-muted-foreground">· {inv.addOnCategories.find(c => c.id === addOn.category)?.label}</span>
                        )}
                      </td>
                      {inv.packages.map((pkg) => {
                        const config = addOn.packages[pkg.id]
                        const isIncluded = config?.included === true
                        const hasPrice = config?.price !== undefined
                        return (
                          <td key={pkg.id} className="px-3 py-2 text-center">
                            {isIncluded ? (
                              <button
                                onClick={() => cycleCell(ai, pkg.id)}
                                className="rounded-full bg-brand-1 px-2 py-0.5 text-xs font-medium text-white"
                              >
                                Included
                              </button>
                            ) : hasPrice ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-muted-foreground">{sym}</span>
                                <input
                                  type="number"
                                  value={config!.price}
                                  onChange={(e) => setCellPrice(ai, pkg.id, Number(e.target.value))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-16 rounded border border-border bg-transparent px-1 py-0.5 text-center text-xs text-foreground focus:border-foreground outline-none"
                                />
                                <button onClick={() => cycleCell(ai, pkg.id)} className="text-muted-foreground hover:text-foreground transition-colors">↻</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => cycleCell(ai, pkg.id)}
                                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                              >
                                —
                              </button>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-2 py-2">
                        <button onClick={() => removeAddOn(ai)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {inv.addOns.length === 0 && (
            <button onClick={addAddOn} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add first add-on
            </button>
          )}
        </div>
      )}

      {/* ── Add-on Detail Cards ── */}
      {inv.addOns.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Add-on details</h2>
          {inv.addOns.map((addOn, ai) => (
            <div key={addOn.id} className="rounded-lg border border-border p-4 space-y-2">
              <input
                type="text"
                value={addOn.label}
                onChange={(e) => updateAddOn(ai, "label", e.target.value)}
                placeholder="Add-on name"
                className="builder-input text-sm font-medium"
              />
              <input
                type="text"
                value={addOn.description}
                onChange={(e) => updateAddOn(ai, "description", e.target.value)}
                placeholder="Short description shown on the card"
                className="builder-input"
              />
              <select
                value={addOn.category}
                onChange={(e) => updateAddOn(ai, "category", e.target.value)}
                className="builder-input"
              >
                <option value="">No category</option>
                {inv.addOnCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* ── Suggested Add-ons ── */}
      {suggestions?.addOns && suggestions.addOns.length > 0 && !dismissedSuggestions.includes("addOns") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Suggested add-ons</h2>
            <button onClick={() => dismissSuggestion("addOns")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Dismiss all</button>
          </div>
          <p className="text-xs text-muted-foreground">Accept individual add-ons to add them to the matrix.</p>
          <div className="space-y-2">
            {suggestions.addOns.map((suggested, i) => {
              const path = `addOns.${i}`
              if (dismissedSuggestions.includes(path)) return null
              return (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-brand-1/25 bg-brand-1/5 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{suggested.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{suggested.description}</p>
                    <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{suggested.category}</span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => {
                        // Find or create category
                        let catId = inv.addOnCategories.find(c => c.label.toLowerCase() === suggested.category.toLowerCase())?.id
                        let cats = inv.addOnCategories
                        if (!catId) {
                          catId = uuidv4().slice(0, 8)
                          cats = [...cats, { id: catId, label: suggested.category }]
                        }
                        // Build add-on with all packages unavailable by default
                        const pkgs: AddOn["packages"] = {}
                        inv.packages.forEach(p => { pkgs[p.id] = {} })
                        const addOn: AddOn = {
                          id: uuidv4().slice(0, 8),
                          label: suggested.label,
                          description: suggested.description,
                          category: catId,
                          packages: pkgs,
                        }
                        updateField("investment", { ...inv, addOnCategories: cats, addOns: [...inv.addOns, addOn] })
                        dismissSuggestion(path)
                      }}
                      className="text-xs font-medium text-brand-1 hover:underline"
                    >
                      Accept
                    </button>
                    <button onClick={() => dismissSuggestion(path)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Categories ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Categories</h2>
          <button onClick={addCategory} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {inv.addOnCategories.map((cat, i) => (
            <div key={cat.id} className="flex items-center gap-2">
              <input
                type="text"
                value={cat.label}
                onChange={(e) => updateCategory(i, e.target.value)}
                placeholder="Brand"
                className="builder-input"
              />
              <button onClick={() => removeCategory(i)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Retainer ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Retainer</h2>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={!!inv.retainer} onChange={toggleRetainer} className="accent-[var(--brand-1)]" />
            Include retainer
          </label>
        </div>
        {inv.retainer && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Hourly rate ({sym})</p>
              <input type="number" value={inv.retainer.hourlyRate} onChange={(e) => updateRetainer("hourlyRate", Number(e.target.value))} className="builder-input" />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Required months</p>
              <input type="number" value={inv.retainer.requiredMonths} onChange={(e) => updateRetainer("requiredMonths", Number(e.target.value))} className="builder-input" />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Min hours/mo</p>
              <input type="number" value={inv.retainer.minHours} onChange={(e) => updateRetainer("minHours", Number(e.target.value))} className="builder-input" />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Max hours/mo</p>
              <input type="number" value={inv.retainer.maxHours} onChange={(e) => updateRetainer("maxHours", Number(e.target.value))} className="builder-input" />
            </div>
          </div>
        )}
      </div>

      {/* ── Post-Launch Optimization ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Post-Launch Optimization</h2>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={!!inv.postLaunch} onChange={togglePostLaunch} className="accent-[var(--brand-1)]" />
            Include post-launch
          </label>
        </div>
        {inv.postLaunch && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Monthly price ({sym})</p>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{sym}</span>
                <input type="number" value={inv.postLaunch.monthlyPrice} onChange={(e) => updatePostLaunch("monthlyPrice", Number(e.target.value))} className="builder-input" />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Description</p>
              <textarea
                value={inv.postLaunch.description}
                onChange={(e) => updatePostLaunch("description", e.target.value)}
                rows={3}
                placeholder="What this service includes..."
                className="builder-input resize-none"
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Features (one per line)</p>
              <textarea
                value={inv.postLaunch.features.join("\n")}
                onChange={(e) => updatePostLaunch("features", e.target.value.split("\n").filter(Boolean))}
                rows={3}
                placeholder={"Conversion monitoring\nFunnel improvements\nA/B testing"}
                className="builder-input resize-none font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Included in package</p>
                <select
                  value={inv.postLaunch.includedInPackage ?? ""}
                  onChange={(e) => updatePostLaunch("includedInPackage", e.target.value || undefined)}
                  className="builder-input"
                >
                  <option value="">None</option>
                  {inv.packages.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              {inv.postLaunch.includedInPackage && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Included weeks</p>
                  <input type="number" value={inv.postLaunch.includedWeeks ?? 0} onChange={(e) => updatePostLaunch("includedWeeks", Number(e.target.value))} className="builder-input" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

export default BuilderSectionInvestment
