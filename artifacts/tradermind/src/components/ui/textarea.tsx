import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, onChange, value, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null);
    const selRef = React.useRef<{ start: number; end: number } | null>(null);

    // Merge external ref with our internal ref
    const setRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        internalRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      },
      [ref],
    );

    // After every render, restore cursor if we saved a position from onChange
    React.useLayoutEffect(() => {
      const el = internalRef.current;
      const sel = selRef.current;
      selRef.current = null;
      if (el && sel !== null && document.activeElement === el) {
        el.setSelectionRange(sel.start, sel.end);
      }
    });

    const handleChange = onChange
      ? (e: React.ChangeEvent<HTMLTextAreaElement>) => {
          // Save cursor position BEFORE calling onChange (which triggers re-render)
          selRef.current = {
            start: e.target.selectionStart ?? 0,
            end: e.target.selectionEnd ?? 0,
          };
          onChange(e);
        }
      : undefined;

    return (
      <textarea
        className={cn(
          'flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className,
        )}
        ref={setRef}
        value={value}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
