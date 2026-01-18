"use client";
import { motion } from "framer-motion";
import { RefObject } from "react";
import { cn } from "@/lib/utils";

interface TimelineContentProps {
    children: React.ReactNode;
    animationNum?: number;
    timelineRef?: RefObject<any>;
    customVariants?: any;
    className?: string;
    as?: any;
}

export const TimelineContent = ({
    children,
    animationNum = 0,
    timelineRef,
    customVariants,
    className,
    as = "div",
}: TimelineContentProps) => {
    const Component = motion(as as any);

    return (
        <Component
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={customVariants}
            custom={animationNum}
            className={cn(className)}
        >
            {children}
        </Component>
    );
};
