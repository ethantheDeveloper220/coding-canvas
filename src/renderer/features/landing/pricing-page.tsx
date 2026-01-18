import { useState } from "react"
import { Check, Sparkles, Zap, Crown, ArrowLeft } from "lucide-react"

export function PricingPage() {
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")

    const plans = [
        {
            name: "Free",
            description: "Perfect for trying out 1Code",
            price: { monthly: 0, yearly: 0 },
            icon: Sparkles,
            features: [
                "5 AI requests per day",
                "Basic code completion",
                "1 project",
                "Community support",
                "Local models only",
            ],
            cta: "Get Started",
            popular: false,
        },
        {
            name: "Pro",
            description: "For professional developers",
            price: { monthly: 19, yearly: 190 },
            icon: Zap,
            features: [
                "Unlimited AI requests",
                "Advanced code completion",
                "Unlimited projects",
                "Priority support",
                "All AI models",
                "Code review assistance",
                "Refactoring suggestions",
            ],
            cta: "Start Free Trial",
            popular: true,
        },
        {
            name: "Enterprise",
            description: "For teams and organizations",
            price: { monthly: 49, yearly: 490 },
            icon: Crown,
            features: [
                "Everything in Pro",
                "Team collaboration",
                "Custom AI models",
                "Dedicated support",
                "SSO & advanced security",
                "Usage analytics",
                "Custom integrations",
                "SLA guarantee",
            ],
            cta: "Contact Sales",
            popular: false,
        },
    ]

    return (
        <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-auto">
            {/* Draggable title bar area */}
            <div
                className="fixed top-0 left-0 right-0 h-10 z-50"
                style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            />

            {/* Navigation */}
            <nav className="fixed top-10 left-0 right-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                    <button
                        onClick={() => window.history.back()}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <span className="text-sm font-semibold">1Code</span>
                    </div>
                    <div className="w-16" /> {/* Spacer */}
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 pt-24 pb-12">
                {/* Header */}
                <section className="px-6 py-12">
                    <div className="max-w-4xl mx-auto text-center space-y-6">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                            Choose Your Perfect Plan
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Start free and scale as you grow. All plans include a 14-day free trial.
                        </p>

                        {/* Billing Toggle */}
                        <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-border bg-muted/30">
                            <button
                                onClick={() => setBillingCycle("monthly")}
                                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${billingCycle === "monthly"
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setBillingCycle("yearly")}
                                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors inline-flex items-center gap-2 ${billingCycle === "yearly"
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                Yearly
                                <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 dark:text-green-400">
                                    Save 20%
                                </span>
                            </button>
                        </div>
                    </div>
                </section>

                {/* Pricing Cards */}
                <section className="px-6 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid md:grid-cols-3 gap-6">
                            {plans.map((plan, index) => (
                                <div key={plan.name} className="relative">
                                    {plan.popular && (
                                        <div className="absolute -top-3 left-0 right-0 flex justify-center">
                                            <div className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                                                Most Popular
                                            </div>
                                        </div>
                                    )}

                                    <div
                                        className={`p-6 rounded-lg border h-full flex flex-col ${plan.popular
                                                ? "border-primary bg-card shadow-lg"
                                                : "border-border bg-card"
                                            }`}
                                    >
                                        {/* Icon */}
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                            <plan.icon className="w-5 h-5 text-primary" />
                                        </div>

                                        {/* Plan Name */}
                                        <h3 className="text-xl font-semibold mb-1">{plan.name}</h3>
                                        <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>

                                        {/* Price */}
                                        <div className="mb-6">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-bold">
                                                    ${plan.price[billingCycle]}
                                                </span>
                                                {plan.price.monthly > 0 && (
                                                    <span className="text-muted-foreground text-sm">
                                                        /{billingCycle === "monthly" ? "mo" : "yr"}
                                                    </span>
                                                )}
                                            </div>
                                            {billingCycle === "yearly" && plan.price.yearly > 0 && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    ${(plan.price.yearly / 12).toFixed(2)}/month billed annually
                                                </p>
                                            )}
                                        </div>

                                        {/* CTA Button */}
                                        <button
                                            className={`w-full h-8 rounded-lg text-sm font-medium mb-6 transition-colors ${plan.popular
                                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                                    : "border border-border hover:bg-muted/50"
                                                }`}
                                        >
                                            {plan.cta}
                                        </button>

                                        {/* Features */}
                                        <div className="space-y-3 flex-1">
                                            {plan.features.map((feature, i) => (
                                                <div key={i} className="flex items-start gap-2">
                                                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                                    <span className="text-sm text-muted-foreground">{feature}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section className="px-6 py-12">
                    <div className="max-w-3xl mx-auto">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-semibold mb-2">Frequently Asked Questions</h2>
                            <p className="text-muted-foreground">Everything you need to know about our pricing</p>
                        </div>

                        <div className="space-y-4">
                            {[
                                {
                                    q: "Can I change plans later?",
                                    a: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.",
                                },
                                {
                                    q: "What payment methods do you accept?",
                                    a: "We accept all major credit cards, PayPal, and wire transfers for Enterprise plans.",
                                },
                                {
                                    q: "Is there a free trial?",
                                    a: "Yes! All paid plans include a 14-day free trial. No credit card required.",
                                },
                                {
                                    q: "Can I cancel anytime?",
                                    a: "Absolutely. You can cancel your subscription at any time with no penalties.",
                                },
                            ].map((faq, index) => (
                                <div
                                    key={index}
                                    className="p-4 rounded-lg border border-border bg-card"
                                >
                                    <h3 className="text-sm font-semibold mb-1">{faq.q}</h3>
                                    <p className="text-sm text-muted-foreground">{faq.a}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-border py-6 px-6">
                <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
                    <p>┬⌐ 2026 1Code. All rights reserved.</p>
                </div>
            </footer>
        </div>
    )
}
