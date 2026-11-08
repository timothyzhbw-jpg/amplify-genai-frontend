import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ScrollableTabStrip, scrollEdges } from '../ScrollableTabStrip';

describe('scrollEdges', () => {
    it('reports nothing hidden when the content fits', () => {
        expect(scrollEdges({ scrollLeft: 0, clientWidth: 500, scrollWidth: 500 })).toEqual({ left: false, right: false });
    });

    it('reports hidden content on the right at the start', () => {
        expect(scrollEdges({ scrollLeft: 0, clientWidth: 400, scrollWidth: 700 })).toEqual({ left: false, right: true });
    });

    it('reports both edges in the middle and only the left at the end', () => {
        expect(scrollEdges({ scrollLeft: 150, clientWidth: 400, scrollWidth: 700 })).toEqual({ left: true, right: true });
        expect(scrollEdges({ scrollLeft: 300, clientWidth: 400, scrollWidth: 700 })).toEqual({ left: true, right: false });
    });

    it('ignores sub-pixel leftovers', () => {
        expect(scrollEdges({ scrollLeft: 0.5, clientWidth: 400, scrollWidth: 400.6 })).toEqual({ left: false, right: false });
    });
});

describe('ScrollableTabStrip', () => {
    it('renders its tabs with the native scrollbar hidden and no arrows before layout is known', () => {
        const html = renderToStaticMarkup(
            <ScrollableTabStrip>
                <button type="button">First</button>
                <button type="button">Second</button>
            </ScrollableTabStrip>,
        );
        expect(html).toContain('First');
        expect(html).toContain('Second');
        expect(html).toContain('scrollbar-width:none');
        expect(html).not.toContain('Scroll tabs');
    });
});
