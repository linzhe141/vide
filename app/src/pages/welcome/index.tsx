import { Button } from '@/app/src/ui/Button'
import { Popover } from '../../ui/Popover'
import { useState } from 'react'
import { Select } from '../../ui/Select'

export function Welcome() {
  const [open, setOpen] = useState(false)
  const options = [
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
    { label: 'Orange', value: 'orange' },
  ]

  const [value, setValue] = useState<string>()
  return (
    <div className='space-y-2 p-5'>
      <div>
        <Button variant='outline'>hello</Button>
      </div>

      <div>
        <Popover
          open={open}
          onOpenChange={setOpen}
          reference={
            <Button variant='outline' size='sm' onClick={() => setOpen(!open)}>
              {open ? 'Close' : 'Open'}
            </Button>
          }
        >
          <div>content!</div>
        </Popover>
      </div>
      <div>
        <Select
          value={value}
          onChange={setValue}
          options={options}
          placeholder='Choose fruit'
        />
      </div>
    </div>
  )
}
