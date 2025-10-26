// /src/components/ui/use-toast.tsx
import * as React from "react"
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

// Default duration for toasts if not specified, in milliseconds
// Radix UI's ToastPrimitives.Root also has a 'duration' prop.
// This constant can serve as a default for the 'duration' prop if you want to manage it here.
// A common default is 5000ms (5 seconds).
const DEFAULT_TOAST_DURATION = 5000;
const TOAST_LIMIT = 5; // Maximum number of toasts to display at once

// Extended toast properties for state management
export type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  duration?: number // Allow overriding duration per toast
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST", // Transitions toast to closed state
  REMOVE_TOAST: "REMOVE_TOAST",   // Removes toast from the list
} as const

let count = 0

// Generates unique IDs for toasts
function genId(): string {
  count = (count + 1) % Number.MAX_SAFE_INTEGER // Use MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

// Defines the shape of actions that can be dispatched
type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast> & { id: string } // Ensure id is present for updates
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: string // Optional: dismiss all if not provided
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: string // Optional: remove all if not provided
    }

interface State {
  toasts: ToasterToast[]
}

// Store for active timeouts, mapping toastId to its timeout ID
const toastTimeouts = new Map<string, NodeJS.Timeout>()

// Reducer function to manage toast state
const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action
      // Clear scheduled timeout if a specific toast is dismissed
      if (toastId) {
        const timeoutId = toastTimeouts.get(toastId)
        if (timeoutId) {
          clearTimeout(timeoutId)
          toastTimeouts.delete(toastId)
        }
      } else {
        // Clear all timeouts if dismissing all toasts
        toastTimeouts.forEach(clearTimeout)
        toastTimeouts.clear()
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false, // Set open to false to trigger Radix's exit animation
              }
            : t
        ),
      }
    }
    case actionTypes.REMOVE_TOAST: {
       const { toastId } = action
      // Clear scheduled timeout if a specific toast is removed
      if (toastId) {
        const timeoutId = toastTimeouts.get(toastId)
        if (timeoutId) {
          clearTimeout(timeoutId)
          toastTimeouts.delete(toastId)
        }
      } else {
        // Clear all timeouts if removing all toasts
        toastTimeouts.forEach(clearTimeout)
        toastTimeouts.clear()
      }
      
      if (toastId === undefined) {
        return { ...state, toasts: [] }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== toastId),
      }
    }
    default:
      return state
  }
}

const listeners: Array<(state: State) => void> = []
let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

// Type for the props accepted by the toast function
type ShowToastProps = Omit<ToasterToast, "id" | "open" | "onOpenChange">;

function toast(props: ShowToastProps) {
  const id = genId()
  const duration = props.duration || DEFAULT_TOAST_DURATION;

  // Define how `onOpenChange` (from Radix) interacts with our state
  // When Radix toast's open state becomes false (e.g. after duration, swipe, or close button),
  // we dispatch REMOVE_TOAST to remove it from our list.
  const onOpenChange = (open: boolean) => {
    if (!open) {
      // Ensure this specific toast's timeout is cleared if it exists
      const timeoutId = toastTimeouts.get(id);
      if (timeoutId) {
        clearTimeout(timeoutId);
        toastTimeouts.delete(id);
      }
      // Remove the toast from the state
      dispatch({ type: actionTypes.REMOVE_TOAST, toastId: id })
    }
  }

  const newToast: ToasterToast = {
    ...props,
    id,
    open: true,
    duration, // Pass duration to the toast data
    onOpenChange,
  }

  dispatch({ type: actionTypes.ADD_TOAST, toast: newToast })

  // If a duration is set, schedule a DISMISS_TOAST action.
  // Radix's `duration` prop on `ToastPrimitives.Root` will handle closing the toast visually.
  // `onOpenChange` (defined above) will then trigger `REMOVE_TOAST`.
  // This manual timeout for DISMISS_TOAST is an alternative if not relying solely on Radix's duration prop
  // or if you need to perform actions *before* Radix closes the toast.
  // For typical shadcn/ui, relying on Radix's duration passed to the component is cleaner.
  // The timeout here ensures that `open` is set to `false` in our state,
  // which then triggers the `onOpenChange` that leads to `REMOVE_TOAST`.
  const timeoutId = setTimeout(() => {
    dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id })
  }, duration)
  toastTimeouts.set(id, timeoutId)


  return {
    id: id,
    dismiss: () => dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id }),
    update: (updatedProps: Partial<ToasterToast>) =>
      dispatch({ type: actionTypes.UPDATE_TOAST, toast: { ...updatedProps, id } }),
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state]) // Dependency on state ensures re-subscription if state identity changes (unlikely here)

  return {
    ...state, // current toasts: ToasterToast[]
    toast,    // function to show a new toast
    dismiss: (toastId?: string) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  }
}

export { useToast, toast }