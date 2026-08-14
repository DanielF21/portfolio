"use client";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import {
  motion,
  motionValue,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import React, { useContext, useMemo, useRef } from "react";

export interface DockProps extends VariantProps<typeof dockVariants> {
  className?: string;
  magnification?: number;
  distance?: number;
  children: React.ReactNode;
}

const DEFAULT_MAGNIFICATION = 60;
const DEFAULT_DISTANCE = 140;

const dockVariants = cva(
  "mx-auto w-max h-full p-2 flex items-end rounded-full border"
);

/**
 * Dock hands its icons the shared pointer position through context rather than
 * by cloning them with injected props.
 *
 * cloneElement cannot work here. `Navbar` is a Server Component, so the
 * <DockIcon> elements it creates carry a client-reference proxy as their
 * `type`, not the DockIcon function itself, and an identity check against it
 * fails. The original workaround was to clone any child whose type was a
 * function or object, which caught every component in the dock, including the
 * <Separator /> siblings, and Radix spreads unrecognised props straight onto
 * its <div>: that is where the "React does not recognize the `mouseX` prop on a
 * DOM element" warning came from.
 *
 * Context sidesteps both problems. It reaches DockIcon wherever its element was
 * created, and it passes through Separator without touching it.
 */
interface DockContextValue {
  mouseX: MotionValue<number>;
  magnification: number;
  distance: number;
}

/** Fallback so a DockIcon used outside a Dock still has a MotionValue to
 *  transform rather than crashing on `undefined`. Created at module scope
 *  because a default context value cannot call hooks. */
const IDLE_MOUSE_X = motionValue(Infinity);

const DockContext = React.createContext<DockContextValue>({
  mouseX: IDLE_MOUSE_X,
  magnification: DEFAULT_MAGNIFICATION,
  distance: DEFAULT_DISTANCE,
});

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  (
    {
      className,
      children,
      magnification = DEFAULT_MAGNIFICATION,
      distance = DEFAULT_DISTANCE,
      ...props
    },
    ref
  ) => {
    const mouseX = useMotionValue(Infinity);

    const context = useMemo(
      () => ({ mouseX, magnification, distance }),
      [mouseX, magnification, distance]
    );

    return (
      <motion.div
        ref={ref}
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className={cn(dockVariants({ className }))}
        {...props}
      >
        <DockContext.Provider value={context}>{children}</DockContext.Provider>
      </motion.div>
    );
  }
);

Dock.displayName = "Dock";

export interface DockIconProps {
  size?: number;
  /** Overrides the value supplied by the enclosing Dock. */
  magnification?: number;
  /** Overrides the value supplied by the enclosing Dock. */
  distance?: number;
  /** Overrides the value supplied by the enclosing Dock. */
  mouseX?: MotionValue<number>;
  className?: string;
  children?: React.ReactNode;
}

const DockIcon = ({
  size,
  magnification,
  distance,
  mouseX,
  className,
  children,
  ...restProps
}: DockIconProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const dock = useContext(DockContext);

  // Explicit props win, otherwise take the enclosing Dock's values.
  const resolvedMouseX = mouseX ?? dock.mouseX;
  const resolvedMagnification = magnification ?? dock.magnification;
  const resolvedDistance = distance ?? dock.distance;

  const distanceCalc = useTransform(resolvedMouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  let widthSync = useTransform(
    distanceCalc,
    [-resolvedDistance, 0, resolvedDistance],
    [40, resolvedMagnification, 40]
  );

  let width = useSpring(widthSync, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  return (
    <motion.div
      ref={ref}
      style={{ width }}
      className={cn(
        "flex aspect-square cursor-pointer items-center justify-center rounded-full",
        className
      )}
      {...restProps}
    >
      {children}
    </motion.div>
  );
};

DockIcon.displayName = "DockIcon";

export { Dock, DockIcon, dockVariants };