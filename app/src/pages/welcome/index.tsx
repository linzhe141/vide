import { Button } from '@/app/src/ui/Button'
import { Popover } from '../../ui/Popover'
import { useState } from 'react'
import { Select } from '../../ui/Select'
import { Apple, Banana } from 'lucide-react'

export function Welcome() {
  const [open, setOpen] = useState(false)

  const [value, setValue] = useState<string>('apple')
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
          options={[
            {
              element: (
                <div className='flex items-center gap-2'>
                  <Apple className='size-4 text-red-500'></Apple> Apple
                </div>
              ),
              value: 'apple',
            },
            {
              element: (
                <div className='flex items-center gap-2'>
                  <Banana className='size-4 stroke-1 text-yellow-500'></Banana> Banana
                </div>
              ),
              value: 'banana',
            },
            {
              element: <div className='flex items-center gap-2'>Orange</div>,
              value: 'orange',
            },
          ]}
          placeholder='Choose fruit'
        />
      </div>
    </div>
  )
}
