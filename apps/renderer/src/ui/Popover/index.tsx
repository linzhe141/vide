// TODO upgrade floating ui
import { usePopper, type PopperChildrenProps } from 'react-popper'
import { cn } from '../../lib/utils'
import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react'

interface PopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reference: ReactNode
  placement?: PopperChildrenProps['placement']
  className?: string
}

export function Popover({
  open,
  onOpenChange,
  reference,
  children,
  placement = 'bottom-start',
  className,
}: PropsWithChildren<PopoverProps>) {
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null)
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement,
    modifiers: [
      { name: 'offset', options: { offset: [0, 6] } },
      { name: 'preventOverflow', options: { padding: 8 } },
    ],
  })

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        popperElement &&
        !popperElement.contains(e.target as Node) &&
        referenceElement &&
        !referenceElement.contains(e.target as Node)
      ) {
        onOpenChange(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', onClickOutside)
    }
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open, popperElement, referenceElement, onOpenChange])

  return (
    <>
      <div ref={setReferenceElement} className='inline-block'>
        {reference}
      </div>

      {open && (
        <div
          ref={setPopperElement}
          style={styles.popper}
          {...attributes.popper}
          className={cn('border-border bg-background z-50 rounded-md border shadow-lg', className)}
        >
          {children}
        </div>
      )}
    </>
  )
}
