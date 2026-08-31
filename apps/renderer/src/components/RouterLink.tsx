import { NavLink, useNavigate } from 'react-router'

export function RouterLink(props: React.ComponentProps<typeof NavLink>) {
  const navigate = useNavigate()
  return (
    <NavLink
      {...props}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          navigate(props.to)
        }
      }}
    />
  )
}
