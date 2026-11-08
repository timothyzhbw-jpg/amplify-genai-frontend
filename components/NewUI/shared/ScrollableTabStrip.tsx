/**
 * ScrollableTabStrip — a single row of tabs that scrolls sideways instead of wrapping or clipping.
 *
 * The native scrollbar is hidden (a classic Windows/Linux scrollbar would take height from the row
 * and push the labels off its centre line). Instead, an arrow appears on each edge that still hides
 * tabs, so a mouse user with a plain wheel can reach every tab.
 *
 * The arrows float over the scroller's edges instead of sitting beside it, so showing or hiding one
 * never resizes the scroller: content never shifts under the pointer, and the overflow test cannot
 * get stuck "on" at widths where every tab fits. The whole solid part of each arrow is its click
 * target, so a near-miss scrolls rather than selecting a tab hidden underneath.
 *
 * The selected tab (`activeKey`) and any focused tab are scrolled into view with
 * `scrollIntoView({ inline: 'nearest' })`, which honours `scroll-padding-inline` and so keeps them
 * clear of the arrows. Browsers' own focus scrolling does not (it leaves a partly visible tab where
 * it is), hence the explicit focus handler. The arrows are recomputed in the same pass, so they never
 * lag behind the scroll position (scroll events are frame-bound and a background page throttles
 * frames).
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

export interface ScrollEdges {
    left: boolean;
    right: boolean;
}

/** Which edges of a horizontal scroller still hide content (1px slack for sub-pixel layouts). */
export const scrollEdges = (el: { scrollLeft: number; clientWidth: number; scrollWidth: number }): ScrollEdges => ({
    left: el.scrollLeft > 1,
    right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
});

/** Width of each arrow overlay; also the scroll padding that keeps a revealed tab clear of it. */
const ARROW_ZONE_PX = 40;

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const tabSelector = (key: string) =>
    `[data-tab-id="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(key) : key}"]`;

const reveal = (tab: Element | null | undefined) =>
    (tab as HTMLElement | null | undefined)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });

export interface ScrollableTabStripProps {
    /** Tab buttons, each carrying `data-tab-id`. */
    children: React.ReactNode;
    /** `data-tab-id` of the selected tab; kept in view when it changes and when the strip resizes. */
    activeKey?: string;
    /** Attached to the outer element. */
    rootRef?: React.Ref<HTMLDivElement>;
    className?: string;
}

export const ScrollableTabStrip: React.FC<ScrollableTabStripProps> = ({ children, activeKey, rootRef, className = '' }) => {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const activeKeyRef = useRef(activeKey);
    activeKeyRef.current = activeKey;
    const [edges, setEdges] = useState<ScrollEdges>({ left: false, right: false });

    const update = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;
        const next = scrollEdges(el);
        setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
    }, []);

    const revealActive = useCallback(() => {
        const el = scrollerRef.current;
        const key = activeKeyRef.current;
        if (el && key !== undefined) reveal(el.querySelector(tabSelector(key)));
    }, []);

    // After every render: a label change ("Loading Groups…" → "Groups") changes the content width
    // without resizing the scroller itself.
    useIsomorphicLayoutEffect(update);

    // Selection changed: bring the tab into view and recompute the arrows synchronously.
    useIsomorphicLayoutEffect(() => {
        revealActive();
        update();
    }, [activeKey, revealActive, update]);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;
        // Narrowing the strip can push the selected tab out of view; scrollIntoView is a no-op
        // when it is already inside the padded area.
        const onResize = () => {
            revealActive();
            update();
        };
        el.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', onResize);
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
        observer?.observe(el);
        return () => {
            el.removeEventListener('scroll', update);
            window.removeEventListener('resize', onResize);
            observer?.disconnect();
        };
    }, [revealActive, update]);

    const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
        reveal((event.target as HTMLElement).closest?.('[data-tab-id]'));
        update();
    };

    const scrollByStep = (direction: -1 | 1) => {
        const el = scrollerRef.current;
        if (!el) return;
        const reduceMotion = typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        el.scrollBy({ left: direction * Math.max(120, el.clientWidth * 0.6), behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    const arrow = (direction: -1 | 1) => {
        const isLeft = direction < 0;
        const label = isLeft ? 'Scroll tabs left' : 'Scroll tabs right';
        const Icon = isLeft ? IconChevronLeft : IconChevronRight;
        return (
            <div
                className={`absolute inset-y-0 ${isLeft ? 'left-0 justify-start' : 'right-0 justify-end'} flex pointer-events-none`}
                style={{
                    width: ARROW_ZONE_PX,
                    // Fades the tabs underneath into the bar's own background (works in both themes).
                    background: `linear-gradient(to ${isLeft ? 'right' : 'left'}, var(--bg-sidebar) 60%, transparent)`,
                }}
            >
                {/* Full-height hit area over the solid part; only the transparent fade passes clicks
                    through to the partly visible tab. Out of the tab order: focus reveals tabs itself. */}
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => scrollByStep(direction)}
                    aria-label={label}
                    title={label}
                    className="group pointer-events-auto flex items-center justify-center h-full w-7"
                >
                    <span className="flex items-center justify-center w-7 h-7 rounded-[6px] transition-colors text-[--text-secondary] group-hover:bg-[--bg-hover] group-hover:text-[--text-primary]">
                        <Icon size={15} />
                    </span>
                </button>
            </div>
        );
    };

    return (
        <div ref={rootRef} className={`relative flex items-center h-full min-w-0 ${className}`}>
            <div
                ref={scrollerRef}
                onFocus={handleFocus}
                className="flex items-center h-full gap-1 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none', scrollPaddingInline: ARROW_ZONE_PX }}
            >
                {children}
            </div>
            {edges.left && arrow(-1)}
            {edges.right && arrow(1)}
        </div>
    );
};

export default ScrollableTabStrip;
