import { Component, type ReactNode } from 'react'

/** Vangt een fout in een deel van de app op (bv. geen WebGL), zodat de rest blijft werken. */
export class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('Onderdeel uitgeschakeld na fout:', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
