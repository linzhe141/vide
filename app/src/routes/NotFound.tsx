import { Link } from 'react-router'

const GoHome = (
  <button>
    <Link to='/'>go home</Link>
  </button>
)

export default function NotFound() {
  return (
    <div className='mt-20 flex flex-col items-center justify-center gap-7 text-center text-xl'>
      <h1 className='text-2xl'>404 - 页面未找到</h1>
      {GoHome}
    </div>
  )
}
