"use client";
import React from "react";
import { TimelineContent } from "./timeline-animation";
import { useRef } from "react";
import { CheckCircle2, Circle } from "lucide-react";

const roadmapItems = [
    {
        phase: "Phase 1: Foundation",
        status: "completed",
        items: [
            "Core AI Engine Implementation",
            "Basic Code Completion",
            "Syntax Highlighting for 20+ Languages",
            "Local File System Integration",
        ],
    },
    {
        phase: "Phase 2: Intelligence",
        status: "current",
        items: [
            "Context-Aware Chat",
            "Multi-File Refactoring",
            "Smart Debugging Assistant",
            "VS Code Extension Integration",
        ],
    },
    {
        phase: "Phase 3: Collaboration",
        status: "upcoming",
        items: [
            "Real-time Collaboration",
            "Team Knowledge Base",
            "Shared AI Context",
            "Enterprise SSO Integration",
        ],
    },
    {
        phase: "Phase 4: Evolution",
        status: "upcoming",
        items: [
            "Custom Model Fine-tuning",
            "Automated Code Review System",
            "Project-wide Architecture Analysis",
            "Natural Language to Full App Generation",
        ],
    },
];

export function RoadmapSection() {
    const ref = useRef<HTMLDivElement>(null);

    const revealVariants = {
        visible: (i: number) => ({
            y: 0,
            opacity: 1,
            transition: {
                delay: i * 0.2,
                duration: 0.5,
            },
        }),
        hidden: {
            y: 20,
            opacity: 0,
        },
    };

    return (
        <div className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative" ref={ref}>
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-neutral-200 to-neutral-600">
                    Product Roadmap
                </h2>
                <p className="text-neutral-500 max-w-2xl mx-auto">
                    We're building the future of software development. flexible, efficient, and AI-first.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {roadmapItems.map((phase, index) => (
                    <TimelineContent
                        key={phase.phase}
                        animationNum={index}
                        timelineRef={ref}
                        customVariants={revealVariants}
                        className="relative p-6 border border-neutral-800 rounded-2xl bg-neutral-900/50 backdrop-blur-sm"
                    >
                        <div className="absolute -top-3 left-6 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-full text-xs font-medium text-neutral-400">
                            {phase.status === 'completed' && <span className="text-green-500">Completed</span>}
                            {phase.status === 'current' && <span className="text-blue-500">In Progress</span>}
                            {phase.status === 'upcoming' && <span className="text-neutral-500">Upcoming</span>}
                        </div>

                        <h3 className="text-xl font-bold mb-4 mt-2 text-neutral-200">{phase.phase}</h3>

                        <ul className="space-y-3">
                            {phase.items.map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-neutral-400">
                                    {phase.status === 'completed' ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                    ) : phase.status === 'current' ? (
                                        <Circle className="w-5 h-5 text-blue-500 shrink-0" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-neutral-700 shrink-0" />
                                    )}
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </TimelineContent>
                ))}
            </div>
        </div>
    );
}
