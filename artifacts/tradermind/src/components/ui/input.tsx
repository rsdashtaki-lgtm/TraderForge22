import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, onChange, value, ...props }, ref) => {
    const internalRef = React.useRef<HTMLInputElement>(null);
    const selRef = React.useRef<{ start: number; end: number } | null>(null);

    // Merge external ref with our internal ref
    const setRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        internalRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref],
    );

    // After every render, restore cursor if we saved a position from onChange
    React.useLayoutEffect(() => {
      const el = internalRef.current;
      const sel = selRef.current;
      selRef.current = null;
      if (el && sel !== null && document.activeElement === el) {
        try {
          el.setSelectionRange(sel.start, sel.end);
        } catch {
          // setSelectionRange throws for input types like number/date/range — ignore
        }
      }
    });

    const handleChange = onChange
      ? (e: React.ChangeEvent<HTMLInputElement>) => {
          // Save cursor position BEFORE calling onChange (which triggers re-render)
          selRef.current = {
            start: e.target.selectionStart ?? 0,
            end: e.target.selectionEnd ?? 0,
          };
          onChange(e);
        }
      : undefined;

    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
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
Input.displayName = 'Input';

export { Input };
