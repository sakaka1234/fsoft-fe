"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Rendered instead of the children once they have thrown. */
  fallback: ReactNode;
  /** Called once with the error, for logging. */
  onError?: (error: Error) => void;
};

type State = { failed: boolean };

/**
 * A class, because React still has no hook equivalent for catching render
 * errors, and this one is needed: @splinetool/react-spline has no onError prop.
 * Read its source (node_modules/@splinetool/react-spline/dist/react-spline.js)
 * and a failed scene load lands in `if (error) throw error` during render. With
 * no boundary here, one bad network response for a 700KB asset takes down
 * whatever tree the canvas sits in.
 *
 * Deliberately local rather than a route-level error.tsx: a decorative canvas
 * failing should cost the reader the canvas, not the page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
