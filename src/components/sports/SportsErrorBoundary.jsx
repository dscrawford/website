import { Component } from 'react'

// Feed data is untrusted; a render crash here must not unmount the whole SPA
export default class SportsErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="sports-page">
          <p className="league-empty">Scores are unavailable right now.</p>
        </div>
      )
    }
    return this.props.children
  }
}
