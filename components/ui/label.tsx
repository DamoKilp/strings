"use client";

import * as React from "react";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className = '', ...props }, ref) => (
    <label ref={ref} className={`text-sm font-medium leading-none text-slate-900 dark:text-slate-100 ${className}`} {...props} />
  )
);
Label.displayName = 'Label';

export { Label };




