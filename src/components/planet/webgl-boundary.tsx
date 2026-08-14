"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onError: () => void;
}

/**
 * A three.js throw must not white-screen the home page. There is no hook
 * equivalent for error boundaries, so this stays a class component.
 */
export class WebglBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[planet] scene crashed, falling back to 2D", error);
    this.props.onError();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
