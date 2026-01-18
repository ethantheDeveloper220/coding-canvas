"use client";
import React from "react";
import { cn } from "@/lib/utils";
import { Code2, Zap, Shield, Sparkles, Brain, Cpu } from "lucide-react";

export function FeaturesSection() {
    const features = [
        {
            title: "AI-Powered Coding",
            description:
                "Write code faster with intelligent AI assistance that understands your project context and specific coding style.",
            icon: <Brain className="w-6 h-6 text-primary" />,
        },
        {
            title: "Lightning Fast Speed",
            description:
                "Optimized performance with instant responses and real-time code suggestions that keep you in the flow.",
            icon: <Zap className="w-6 h-6 text-primary" />,
        },
        {
            title: "Secure & Private",
            description:
                "Your code stays private. Enterprise-grade security with local-first architecture ensuring your data never leaves your machine.",
            icon: <Shield className="w-6 h-6 text-primary" />,
        },
        {
            title: "Smart Refactoring",
            description:
                "Intelligent refactoring tools that help you clean up code and improve quality with a single click.",
            icon: <Sparkles className="w-6 h-6 text-primary" />,
        },
        {
            title: "Multi-Language Support",
            description:
                "Seamless support for TypeScript, Python, Go, and more with intelligent syntax highlighting and completion.",
            icon: <Code2 className="w-6 h-6 text-primary" />,
        },
        {
            title: "Advanced Analysis",
            description:
                "Deep static analysis to catch bugs before they happen and suggest improvements for better code health.",
            icon: <Cpu className="w-6 h-6 text-primary" />,
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            {features.map((feature, index) => (
                <FeatureCard key={feature.title} {...feature} index={index} />
            ))}
        </div>
    );
}

const FeatureCard = ({
    title,
    description,
    icon,
    index,
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    index: number;
}) => {
    return (
        <div
            className={cn(
                "flex flex-col lg:border-r border-neutral-800 py-10 relative group/feature dark:border-neutral-800",
                (index === 0 || index === 3) && "lg:border-l dark:border-neutral-800",
                index < 3 && "lg:border-b dark:border-neutral-800"
            )}
        >
            {index < 3 && (
                <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            )}
            {index >= 3 && (
                <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
            )}
            <div className="mb-4 relative z-10 px-10 text-neutral-600 dark:text-neutral-400">
                {icon}
            </div>
            <div className="text-lg font-bold mb-2 relative z-10 px-10">
                <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-primary transition-all duration-200 origin-center" />
                <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
                    {title}
                </span>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-10">
                {description}
            </p>
        </div>
    );
};
