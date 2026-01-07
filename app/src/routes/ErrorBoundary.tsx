import { isRouteErrorResponse, Link } from 'react-router'

const GoHome = (
  <button>
    <Link to='/'>go home</Link>
  </button>
)

export function ErrorBoundary({ error }: any) {
  console.log(error)

  if (isRouteErrorResponse(error)) {
    return (
      <>
        <h1>
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
        {GoHome}
      </>
    )
  } else if (error instanceof Error) {
    return (
      <div>
        <h1>Error</h1>
        <p>{error.message}</p>
        <p>The stack trace is:</p>
        <pre>{error.stack}</pre>
        {GoHome}
      </div>
    )
  } else {
    return (
      <>
        <h1>Unknown Error</h1>
        {GoHome}
      </>
    )
  }
}
