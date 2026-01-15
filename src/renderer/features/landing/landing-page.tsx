import { ArrowRight, Code2, Github, Shield, Sparkles, Zap } from "lucide-react"

export function LandingPage() {
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
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <span className="text-sm font-semibold">1Code</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="#/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Pricing
                        </a>
                        <button
                            onClick={() => { window.location.hash = "#/app" }}
                            className="h-7 px-3 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 transition-colors"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 pt-24 pb-12">
                {/* Hero Section */}
                <section className="px-6 py-16">
                    <div className="max-w-4xl mx-auto text-center space-y-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/50 text-xs text-muted-foreground">
                            <Sparkles className="w-3 h-3" />
                            <span>Powered by Advanced AI</span>
                        </div>

                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                            Code Smarter, Ship Faster
                        </h1>

                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            The AI-powered code editor that understands your project. Write, refactor, and debug with unprecedented speed and accuracy.
                        </p>

                        <div className="flex items-center justify-center gap-3 pt-4">
                            <button
                                onClick={() => { window.location.hash = "#/app" }}
                                className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                            >
                                Start Coding
                                <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => window.desktopApi?.openExternal("https://github.com")}
                                className="h-9 px-4 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors inline-flex items-center gap-2"
                            >
                                <Github className="w-4 h-4" />
                                GitHub
                            </button>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="px-6 py-16">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-12">
                            <h2 className="text-2xl font-semibold mb-2">Everything You Need</h2>
                            <p className="text-muted-foreground">Powerful features designed to make you more productive</p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6">
                            {[
                                {
                                    icon: Code2,
                                    title: "AI-Powered Coding",
                                    description: "Write code faster with intelligent AI assistance that understands your project context.",
                                },
                                {
                                    icon: Zap,
                                    title: "Lightning Fast",
                                    description: "Optimized performance with instant responses and real-time code suggestions.",
                                },
                                {
                                    icon: Shield,
                                    title: "Secure & Private",
                                    description: "Your code stays private. Enterprise-grade security with local-first architecture.",
                                },
                            ].map((feature, index) => (
                                <div
                                    key={index}
                                    className="p-6 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                        <feature.icon className="w-5 h-5 text-primary" />
                                    </div>
                                    <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="px-6 py-16">
                    <div className="max-w-3xl mx-auto">
                        <div className="p-8 rounded-lg border border-border bg-muted/30 text-center space-y-4">
                            <h2 className="text-2xl font-semibold">Ready to Transform Your Workflow?</h2>
                            <p className="text-muted-foreground max-w-xl mx-auto">
                                Join thousands of developers who are building faster with AI-powered assistance.
                            </p>
                            <button
                                onClick={() => { window.location.hash = "#/app" }}
                                className="h-9 px-6 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                            >
                                Get Started Free
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-border py-6 px-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-primary-foreground" />
                        </div>
                        <span>1Code</span>
                    </div>
                    <p>© 2026 1Code. All rights reserved.</p>
                </div>
            </footer>
        </div>
    )
}
